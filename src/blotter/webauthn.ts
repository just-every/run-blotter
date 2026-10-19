// Passkey and security-key verification (WebAuthn level 2) for ACCESS-004:
// registration with "none" attestation and assertions signed with ES256 or
// RS256, checked against the challenge, origin, relying-party hash, user
// presence and signature counter.
import { insist } from './model';

/** Minimal CBOR decoding: unsigned/negative integers, byte and text strings, arrays, maps and simple values. */
function cbor(bytes: Uint8Array) {
  let at = 0;
  const length = (info: number) => {
    if (info < 24) return info;
    const size = info === 24 ? 1 : info === 25 ? 2 : info === 26 ? 4 : info === 27 ? 8 : 0;
    insist(size, 'Unsupported passkey data');
    let n = 0;
    for (let i = 0; i < size; i++) n = n * 256 + bytes[at++];
    return n;
  };
  const item = (): unknown => {
    insist(at < bytes.length, 'Truncated passkey data');
    const head = bytes[at++], major = head >> 5, n = length(head & 31);
    if (major === 0) return n;
    if (major === 1) return -1 - n;
    if (major === 2) { const v = bytes.slice(at, at + n); at += n; return v; }
    if (major === 3) { const v = new TextDecoder().decode(bytes.slice(at, at + n)); at += n; return v; }
    if (major === 4) return Array.from({ length: n }, item);
    if (major === 5) { const map = new Map<unknown, unknown>(); for (let i = 0; i < n; i++) { const k = item(); map.set(k, item()); } return map; }
    insist(major === 7, 'Unsupported passkey data');
    return n === 20 ? false : n === 21 ? true : null;
  };
  const value = item();
  return { value, end: at };
}

export const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export function unb64url(value: unknown, label: string) {
  insist(typeof value === 'string' && /^[A-Za-z0-9_-]+$/.test(value) && value.length <= 20_000, `${label} is not valid`);
  return Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4)), c => c.charCodeAt(0));
}
const sha256 = async (bytes: Uint8Array) => new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>));
const same = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((v, i) => v === b[i]);

type Expect = { type: 'webauthn.create' | 'webauthn.get'; challenge: string; origin: string };
function clientData(raw: Uint8Array, expect: Expect) {
  let data: { type?: string; challenge?: string; origin?: string };
  try { data = JSON.parse(new TextDecoder().decode(raw)); } catch { data = {}; }
  insist(data.type === expect.type, 'The passkey answered a different request');
  insist(data.challenge === expect.challenge, 'This passkey request expired. Try again.');
  insist(data.origin === expect.origin, 'The passkey was used on a different site');
}
async function authenticatorData(raw: Uint8Array, rpId: string) {
  insist(raw.length >= 37, 'Passkey data is incomplete');
  insist(same(raw.slice(0, 32), await sha256(new TextEncoder().encode(rpId))), 'The passkey belongs to a different site');
  const flags = raw[32];
  insist(flags & 1, 'Touch or unlock your passkey to confirm');
  return { flags, signCount: new DataView(raw.buffer, raw.byteOffset + 33, 4).getUint32(0), rest: raw.slice(37) };
}

/** A COSE public key as a WebCrypto JWK: EC2 P-256 with ES256, or RSA with RS256. */
function coseKey(map: Map<unknown, unknown>): JsonWebKey & { alg: string } {
  const kty = map.get(1), alg = map.get(3);
  if (kty === 2 && alg === -7 && map.get(-1) === 1) return { kty: 'EC', crv: 'P-256', x: b64url(map.get(-2) as Uint8Array), y: b64url(map.get(-3) as Uint8Array), alg: 'ES256' };
  if (kty === 3 && alg === -257) return { kty: 'RSA', n: b64url(map.get(-1) as Uint8Array), e: b64url(map.get(-2) as Uint8Array), alg: 'RS256' };
  return insist(false, 'Use a passkey that signs with ES256 or RS256') as never;
}

export async function verifyRegistration(body: Record<string, unknown>, expect: Omit<Expect, 'type'>, rpId: string) {
  clientData(unb64url(body.clientDataJSON, 'Passkey client data'), { ...expect, type: 'webauthn.create' });
  const attestation = cbor(unb64url(body.attestationObject, 'Passkey attestation')).value as Map<string, unknown>;
  insist(attestation instanceof Map && attestation.get('authData') instanceof Uint8Array, 'Passkey attestation is not valid');
  const auth = await authenticatorData(attestation.get('authData') as Uint8Array, rpId);
  insist(auth.flags & 64, 'The passkey did not include its public key');
  const idLength = (auth.rest[16] << 8) | auth.rest[17], credentialId = auth.rest.slice(18, 18 + idLength);
  insist(idLength > 0 && credentialId.length === idLength, 'Passkey credential is not valid');
  const key = cbor(auth.rest.slice(18 + idLength)).value;
  insist(key instanceof Map, 'Passkey public key is not valid');
  return { credentialId: b64url(credentialId), publicKey: coseKey(key), signCount: auth.signCount };
}

/** WebAuthn ES256 signatures are DER; WebCrypto wants r||s. */
function rawSignature(der: Uint8Array) {
  insist(der[0] === 0x30, 'Passkey signature is not valid');
  let at = 2;
  const part = () => { insist(der[at] === 0x02, 'Passkey signature is not valid'); const n = der[at + 1]; const v = der.slice(at + 2, at + 2 + n); at += 2 + n; const t = v[0] === 0 ? v.slice(1) : v; const out = new Uint8Array(32); out.set(t.slice(-32), 32 - Math.min(32, t.length)); return out; };
  const r = part(), s = part(), out = new Uint8Array(64);
  out.set(r); out.set(s, 32);
  return out;
}

export async function verifyAssertion(body: Record<string, unknown>, expect: Omit<Expect, 'type'>, rpId: string, stored: { publicKey: JsonWebKey & { alg: string }; signCount: number }) {
  const rawClient = unb64url(body.clientDataJSON, 'Passkey client data'), rawAuth = unb64url(body.authenticatorData, 'Passkey data');
  clientData(rawClient, { ...expect, type: 'webauthn.get' });
  const auth = await authenticatorData(rawAuth, rpId);
  const signed = new Uint8Array([...rawAuth, ...await sha256(rawClient)]), signature = unb64url(body.signature, 'Passkey signature');
  const { alg, ...jwk } = stored.publicKey;
  const ok = alg === 'ES256'
    ? await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']), rawSignature(signature), signed)
    : await crypto.subtle.verify('RSASSA-PKCS1-v1_5', await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']), signature, signed);
  insist(ok, 'The passkey signature did not verify');
  // A counter that does not move forward means a cloned authenticator.
  insist(auth.signCount === 0 && stored.signCount === 0 || auth.signCount > stored.signCount, 'This passkey may have been copied; ask the principal to reset it', 403);
  return { signCount: auth.signCount };
}
