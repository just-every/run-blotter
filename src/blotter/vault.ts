// Client credential vault (VAULT-001). Client-provided usernames, passwords and
// notes are stored only as AES-GCM ciphertext under the firm's vault key: HKDF of the installation's own
// VAULT_KEY (never the session secret) with the firm's random salt; one
// installation is one firm.
// The principal, reviewers and a preparer who holds a job on the client may list
// them; every reveal needs a fresh second-factor answer for that reveal and is
// logged. Clients write through their portal link and never read a secret back.
// Credentials stay out of search, agent context, mail and CSV exports; archives
// carry the ciphertext or drop it, at the principal's choice.
import { createPortability } from '@runeditrun/rer/modules/portability';
import policy from './archive-policy.mjs';
import { contactGuard } from './client-recipients';
import { portalJob } from './documents';
import { checkFactor, type Site } from './mfa';
import { atomic, audit, date, Fault, guard, human, id, insist, need, now, optional, rows, stmt, text, type Actor, type Data } from './model';

const ARCHIVE_MODES = ['encrypt', 'exclude'] as const;
type Secret = { username: string; password: string; notes: string };

async function firmKey(db: D1Database) {
  await stmt(db, 'INSERT OR IGNORE INTO b_vault_keys(id,salt,archive_mode) VALUES(1,?,?)', btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))), 'encrypt').run();
  return (await stmt(db, 'SELECT salt,archive_mode FROM b_vault_keys WHERE id=1').first<Data>())!;
}
/** The installation's vault key and origin, plus its session secret for the second-factor check. */
export type VaultSite = Site & { vaultKey?: string };
async function vaultKey(site: VaultSite, salt: string) {
  insist(site.vaultKey && site.vaultKey.length >= 32, 'The credential vault key (VAULT_KEY) is not set for this installation. The owner sets it with rer setup.', 503);
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(site.vaultKey), 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: Uint8Array.from(atob(salt), c => c.charCodeAt(0)), info: new TextEncoder().encode('blotter-vault-credentials') },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
/** The credential id is bound as additional data, so ciphertext cannot be moved to another record. */
async function seal(site: VaultSite, salt: string, credentialId: string, value: Secret) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(credentialId) }, await vaultKey(site, salt), new TextEncoder().encode(JSON.stringify(value))));
  return btoa(String.fromCharCode(...iv, ...sealed));
}
async function unseal(site: VaultSite, salt: string, credentialId: string, value: string): Promise<Secret> {
  const bytes = Uint8Array.from(atob(value), c => c.charCodeAt(0)), key = await vaultKey(site, salt);
  try {
    return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12), additionalData: new TextEncoder().encode(credentialId) }, key, bytes.slice(12))));
  } catch { throw new Fault('This credential was sealed under another installation's vault key and cannot be opened here. Ask the client to enter it again.', 409); }
}

/** The client a credential belongs to today: a merged client's credentials follow its survivor. */
const currentClient = (alias: string) => `(SELECT COALESCE(merged_into,id) FROM b_clients WHERE id=${alias}.client_id)`;
/** Staff permitted on a client: the principal, reviewers, and a preparer holding a job on it. */
const permittedSql = `(?='owner' OR ?='reviewer' OR EXISTS(SELECT 1 FROM b_jobs WHERE b_jobs.client_id=? AND b_jobs.preparer_email=?))`;
const permittedParams = (actor: Actor, clientId: string) => [actor.role, actor.role, clientId, actor.email];
async function permittedClient(db: D1Database, actor: Actor, clientId: string) {
  const client = await stmt(db, `SELECT id,name FROM b_clients WHERE id=? AND merged_into IS NULL AND ${permittedSql}`, clientId, ...permittedParams(actor, clientId)).first<Data>();
  insist(client, 'Client not found', 404);
  return client;
}
const listing = (db: D1Database, clientId: string) => rows(db, `SELECT v.id,v.label,v.url,v.rotate_by,v.updated_by,v.updated_at,v.revision,v.sealed IS NULL AND v.erased_at IS NULL excluded,v.erased_at,v.erased_by,v.erase_reason FROM b_vault_credentials v
  WHERE ${currentClient('v')}=? ORDER BY v.label`, clientId);

function fields(body: Data, existing: boolean) {
  const secret = { username: text(body.username, 'Username', 200), password: text(body.password, 'Password', 500), notes: optional(body.notes, 'Notes', 1000) };
  const url = optional(body.url, 'Portal address', 500);
  insist(!url || /^https?:\/\/\S+$/i.test(url), 'Portal address: enter a web address starting with https://');
  return { label: text(body.label, 'Name', 120), url, rotateBy: body.rotateBy ? date(body.rotateBy, 'Rotation reminder date') : null, secret, revision: existing ? Number(body.revision) : 0 };
}

/** Add a credential or replace one in full; nothing is read back. `commit` writes the statements under the caller's own checks. */
async function store(db: D1Database, site: VaultSite, clientId: string, body: Data, by: string, commit: (statements: D1PreparedStatement[]) => Promise<unknown>) {
  const key = await firmKey(db), credentialId = body.id ? text(body.id, 'Credential') : id(), at = now(), f = fields(body, !!body.id);
  const sealed = await seal(site, key.salt, credentialId, f.secret), mode = '(SELECT archive_mode FROM b_vault_keys WHERE id=1)';
  if (body.id) {
    const current = await stmt(db, `SELECT id,revision,erased_at FROM b_vault_credentials v WHERE id=? AND ${currentClient('v')}=?`, credentialId, clientId).first<Data>();
    insist(current, 'Credential not found', 404);
    insist(!current.erased_at, 'This credential was erased; add it again as a new login', 410);
    insist(current.revision === f.revision, 'This credential changed; refresh before saving', 409);
    await commit([...guard(db, 'EXISTS(SELECT 1 FROM b_vault_credentials WHERE id=? AND revision=? AND erased_at IS NULL)', credentialId, f.revision),
      stmt(db, `UPDATE b_vault_credentials SET label=?,url=?,sealed=?,archive_mode=${mode},rotate_by=?,updated_by=?,updated_at=?,revision=revision+1 WHERE id=?`, f.label, f.url, sealed, f.rotateBy, by, at, credentialId)]);
  } else {
    await commit([stmt(db, `INSERT INTO b_vault_credentials(id,client_id,label,url,sealed,archive_mode,rotate_by,created_by,created_at,updated_by,updated_at,revision) VALUES(?,?,?,?,?,${mode},?,?,?,?,?,1)`,
      credentialId, clientId, f.label, f.url, sealed, f.rotateBy, by, at, by, at)]);
  }
  return { id: credentialId, label: f.label, updatedAt: at };
}

export async function staffCredentials(db: D1Database, actor: Actor, clientId: string) {
  human(actor);
  const client = await permittedClient(db, actor, clientId), today = now().slice(0, 10);
  const credentials = (await listing(db, clientId)).map(c => ({ ...c, excluded: !!c.excluded, rotationDue: !!c.rotate_by && c.rotate_by <= today }));
  const key = await stmt(db, 'SELECT archive_mode FROM b_vault_keys WHERE id=1').first<Data>();
  return {
    client, credentials, archiveMode: key?.archive_mode ?? 'encrypt',
    reveals: await rows(db, `SELECT r.credential_id,r.label,r.actor,r.outcome,r.at FROM b_vault_reveals r WHERE r.client_id=? OR r.client_id IN (SELECT id FROM b_clients WHERE merged_into=?) ORDER BY r.at DESC LIMIT 200`, clientId, clientId),
  };
}

export async function staffStore(db: D1Database, actor: Actor, site: VaultSite, clientId: string, body: Data) {
  human(actor); await permittedClient(db, actor, clientId);
  const label = text(body.label, 'Name', 120);
  return store(db, site, clientId, body, actor.email, statements => atomic(db, actor, [...guard(db, permittedSql, ...permittedParams(actor, clientId)), ...statements,
    audit(db, actor, body.id ? 'vault.updated' : 'vault.added', clientId, label)]));
}

const STEP_UP_MINUTES = 5;
const answered = (body: Data) => body.code !== undefined || body.passkey !== undefined || body.recoveryCode !== undefined;

/**
 * Reveal one credential. A reveal needs a step-up from this session in the
 * last five minutes: a fresh TOTP, passkey or recovery-code answer, sent with
 * the reveal or just before it, even when the session already passed its
 * sign-in check. The reveal and every refused attempt on a credential the
 * person may list are logged. Agent keys never reveal.
 */
export async function reveal(db: D1Database, actor: Actor, site: VaultSite, credentialId: string, body: Data) {
  insist(actor.channel === 'person', 'Agents cannot reveal client credentials', 403);
  const credential = await stmt(db, `SELECT v.*,${currentClient('v')} owner_client FROM b_vault_credentials v WHERE v.id=?`, credentialId).first<Data>();
  insist(credential, 'Credential not found', 404);
  await permittedClient(db, actor, credential.owner_client);
  insist(!credential.erased_at, 'This credential was erased', 410);
  const log = (outcome: string) => [stmt(db, 'INSERT INTO b_vault_reveals(id,credential_id,client_id,label,actor,outcome,at) VALUES(?,?,?,?,?,?,?)', id(), credential.id, credential.owner_client, credential.label, actor.email, outcome, now()),
    audit(db, actor, outcome === 'revealed' ? 'vault.revealed' : 'vault.reveal_refused', credential.owner_client, `${credential.label}${outcome === 'revealed' ? '' : ': ' + outcome}`)];
  const since = new Date(Date.now() - STEP_UP_MINUTES * 60_000).toISOString();
  let stepUp: D1PreparedStatement[] = [];
  if (answered(body)) {
    try {
      const { method, statements } = await checkFactor(db, actor, site, body);
      stepUp = [...statements, stmt(db, 'INSERT INTO b_vault_stepups(session_id,email,method,verified_at) VALUES(?,?,?,?) ON CONFLICT(session_id) DO UPDATE SET method=excluded.method,verified_at=excluded.verified_at', actor.sessionId, actor.email, method, now())];
    } catch (error) {
      if (error instanceof Fault) await db.batch(log(error.status === 409 ? 'refused: no second factor set up' : 'refused: second factor not confirmed'));
      throw error;
    }
  } else if (!await stmt(db, 'SELECT 1 FROM b_vault_stepups WHERE session_id=? AND email=? AND verified_at>?', actor.sessionId, actor.email, since).first()) {
    await db.batch(log('refused: step-up required'));
    throw new Fault(`Confirm your second factor to reveal credentials (valid ${STEP_UP_MINUTES} minutes in this session)`, 403, { mfa: 'step-up' });
  }
  insist(credential.sealed, 'This credential was excluded from the archive it was restored from. Ask the client to enter it again.', 409);
  const key = (await stmt(db, 'SELECT salt FROM b_vault_keys WHERE id=1').first<Data>())!;
  const secret = await unseal(site, key.salt, credential.id, credential.sealed);
  await atomic(db, actor, [...stepUp, ...guard(db, permittedSql, ...permittedParams(actor, credential.owner_client)), ...log('revealed')]);
  return { id: credential.id, label: credential.label, url: credential.url, ...secret };
}

/**
 * The principal erases one credential: its ciphertext goes, its name, authors,
 * times and reveal log stay, and every older archive is fenced by the erasure journal.
 */
export async function eraseCredential(db: D1Database, actor: Actor, credentialId: string, body: Data) {
  human(actor); need(actor, 'owner');
  const credential = await stmt(db, `SELECT v.*,${currentClient('v')} owner_client FROM b_vault_credentials v WHERE v.id=?`, credentialId).first<Data>();
  insist(credential, 'Credential not found', 404);
  insist(!credential.erased_at, 'This credential was already erased', 409);
  insist(body.confirm === credential.label, 'Type the credential name to confirm erasing it');
  const reason = text(body.reason, 'Erasure reason', 1000), at = now(), service = await createPortability({ db, policy });
  await atomic(db, actor, [
    stmt(db, 'UPDATE b_vault_credentials SET sealed=NULL,erased_at=?,erased_by=?,erase_reason=?,revision=revision+1 WHERE id=? AND erased_at IS NULL', at, actor.email, reason, credentialId),
    ...await service.redactionStatements(), ...await service.invalidateTransfersStatements(),
    audit(db, actor, 'vault.erased', credential.owner_client, `${credential.label}: ${reason}`)]);
  return { id: credentialId, erased: true, erasedAt: at };
}

/** The principal chooses whether archives carry the ciphertext or drop it. */
export async function setArchiveMode(db: D1Database, actor: Actor, body: Data) {
  human(actor); need(actor, 'owner');
  insist((ARCHIVE_MODES as readonly string[]).includes(body.mode), 'Choose encrypt or exclude');
  await firmKey(db);
  await atomic(db, actor, [stmt(db, 'UPDATE b_vault_keys SET archive_mode=?,set_by=?,set_at=? WHERE id=1', body.mode, actor.email, now()),
    stmt(db, 'UPDATE b_vault_credentials SET archive_mode=?', body.mode), audit(db, actor, 'vault.archive_mode', 'vault', body.mode)]);
  return { archiveMode: body.mode };
}

/** A client contact lists the entity's credentials by name and adds or replaces them; secrets are never sent back. */
export async function portalCredentials(db: D1Database, token: string) {
  const { job } = await portalJob(db, token);
  return { credentials: (await listing(db, job.client_id)).map(({ id, label, url, updated_at, revision }) => ({ id, label, url, updatedAt: updated_at, revision })) };
}
export async function portalStore(db: D1Database, site: VaultSite, token: string, body: Data) {
  const { link, job, contact } = await portalJob(db, token);
  const [live, liveDone] = guard(db, 'EXISTS(SELECT 1 FROM b_portal_links WHERE id=? AND revoked_at IS NULL AND expires_at>?)', link.id, now());
  const [authorized, authorizedDone] = contactGuard(db, job.client_id, contact.id), label = text(body.label, 'Name', 120);
  try {
    return await store(db, site, job.client_id, body, 'client upload link', statements => db.batch([live, authorized, ...statements, liveDone, authorizedDone,
      stmt(db, 'INSERT INTO b_audit(id,actor,action,object_id,detail,at) VALUES(?,?,?,?,?,?)', id(), 'client upload link', body.id ? 'vault.updated' : 'vault.added', job.client_id, label, now())]));
  } catch (error) {
    if (/b_guard|constraint/i.test(String(error))) throw new Fault('This link can no longer save credentials, or the credential changed. Refresh or ask your accountant for a new link.', 409);
    throw error;
  }
}
