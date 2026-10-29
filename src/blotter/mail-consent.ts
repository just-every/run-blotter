// Mail choices are staff evidence only: no mailbox connection or processing authority.
import { atomic, audit, digest, Fault, guard, id, insist, now, rows, stmt, type Actor, type Data } from './model';

const VERSION = 'mail-time-1';
const WORDING = 'I allow mail-derived time suggestions for my own work. I can withdraw this separate choice at any time. Mailboxes are not connected and mail suggestions remain unavailable. This choice grants no provider access or connected processing. Native-work and calendar choices stay separate; no time is recorded without my approval.';
const lastSql = 'SELECT * FROM b_mail_consents WHERE person_id=? ORDER BY sequence DESC LIMIT 1';
const latest = (db: D1Database, actor: Actor) => stmt(db, lastSql, actor.id).first<Data>();

// Rechecked inside the choice batch as well as by the authenticated HTTP door.
const liveSql = `EXISTS(SELECT 1 FROM oa_sessions s JOIN oa_operators o ON o.id=s.operator_id
  WHERE s.id=? AND o.id=? AND o.status='active' AND s.revoked_at IS NULL AND s.expires_at>?
  AND s.operator_version=o.version AND o.version=?
  AND (o.role='owner' OR EXISTS(SELECT 1 FROM b_members m WHERE m.email=o.email AND m.active=1)))
  AND (EXISTS(SELECT 1 FROM b_enterprise_sessions s JOIN b_enterprise_connection c ON c.id=1 AND c.active=1 AND c.revision=s.revision
    JOIN b_enterprise_identities i ON i.id=s.identity_id AND i.active=1 AND i.blocked=0 WHERE s.session_id=? AND i.email=? AND s.mfa=1)
    OR ((NOT EXISTS(SELECT 1 FROM b_mfa_policy WHERE required=1) AND NOT EXISTS(SELECT 1 FROM b_mfa_factors WHERE email=? AND confirmed_at IS NOT NULL))
      OR (EXISTS(SELECT 1 FROM b_mfa_factors WHERE email=? AND confirmed_at IS NOT NULL) AND EXISTS(SELECT 1 FROM b_mfa_sessions WHERE session_id=? AND email=?))))`;
const liveParams = (actor: Actor, version: number) => [actor.sessionId, actor.id, Date.now(), version, actor.sessionId, actor.email, actor.email, actor.email, actor.sessionId, actor.email];
async function staff(db: D1Database, actor: Actor) {
  insist(actor.channel === 'person' && actor.sessionId && !actor.automation, 'A current staff session is required', 403);
  const person = await stmt(db, 'SELECT version FROM oa_operators WHERE id=? AND email=?', actor.id, actor.email).first<Data>();
  insist(person && await stmt(db, `SELECT 1 WHERE ${liveSql}`, ...liveParams(actor, person.version)).first(), 'Your staff session or second factor changed. Sign in again.', 403);
  return person;
}
const token = (actor: Actor, version: number, event: Data | null) => digest(JSON.stringify([actor.id, actor.sessionId, version, VERSION, WORDING, event?.id ?? null, event?.invalidated_at ?? null, event?.restored ?? 0]));
const active = (event: Data | null, version: number) => Boolean(event && event.choice === 'opt_in' && !event.invalidated_at && !event.restored && event.person_version === version);
const evidence = (event: Data) => ({ id: event.id, personId: event.person_id, personEmail: event.person_email, source: event.source,
  wordingVersion: event.wording_version, wording: event.wording, choice: event.choice, actorId: event.actor_id, actor: event.actor_email, at: event.at,
  invalidatedAt: event.invalidated_at, invalidationReason: event.invalidation_reason, historical: Boolean(event.restored) });

export async function mailConsent(db: D1Database, actor: Actor) {
  const person = await staff(db, actor), last = await latest(db, actor);
  return { personId: actor.id, source: 'mail', wordingVersion: VERSION, wording: WORDING, optedIn: active(last, person.version),
    reviewToken: await token(actor, person.version, last), lastId: last?.id ?? null, mailboxesConnected: false, suggestionsAvailable: false,
    // Restored evidence retains its original immutable identity, never active authority for a new account.
    history: (await rows(db, 'SELECT * FROM b_mail_consents WHERE person_id=? OR (restored=1 AND person_email=?) ORDER BY at DESC,sequence DESC', actor.id, actor.email)).map(evidence) };
}

export async function saveMailConsent(db: D1Database, actor: Actor, body: Data) {
  const person = await staff(db, actor);
  insist(!actor.readOnly || body.choice === 'withdraw', 'A writable staff session is required to grant mail consent', 403);
  insist(Object.keys(body).every(k => ['requestId','reviewToken','lastId','wordingVersion','choice'].includes(k)), 'Only your presented mail choice fields are accepted');
  insist(typeof body.requestId === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(body.requestId), 'Supply a unique mail choice request id');
  insist(['decline','opt_in','withdraw'].includes(body.choice), 'Choose whether to allow mail time suggestions');
  insist(body.wordingVersion === VERSION, 'The wording changed. Refresh and review your choice again.', 409);
  const key = await digest(body.requestId), payload = await digest(JSON.stringify([actor.id, body.choice, VERSION, body.lastId ?? null, body.reviewToken ?? null]));
  const receipt = () => stmt(db, 'SELECT * FROM b_mail_consents WHERE person_id=? AND key_digest=?', actor.id, key).first<Data>();
  const replay = async (saved: Data) => {
    insist(saved.payload_digest === payload, 'This mail request was already used for a different choice', 409);
    const last = await latest(db, actor);
    insist(last?.id === saved.id && !saved.restored && !saved.invalidated_at && saved.person_version === person.version, 'This mail choice is historical. Review the current choice.', 409);
    const [check, done] = guard(db, `${liveSql} AND EXISTS(SELECT 1 FROM b_mail_consents WHERE id=? AND invalidated_at IS NULL AND restored=0)
      AND (SELECT id FROM b_mail_consents WHERE person_id=? ORDER BY sequence DESC LIMIT 1)=?`, ...liveParams(actor, person.version), saved.id, actor.id, saved.id);
    await atomic(db, actor, [check, done]);
    return mailConsent(db, actor);
  };
  const saved = await receipt();
  if (saved) return replay(saved);
  const before = await latest(db, actor);
  if (body.reviewToken !== await token(actor, person.version, before) || (body.lastId ?? null) !== (before?.id ?? null)) {
    const winner = await receipt();
    if (winner) return replay(winner);
    throw new Fault('The mail choice changed. Refresh and review your choice again.', 409);
  }
  const [check, done] = guard(db, `${liveSql}
    AND COALESCE((SELECT id FROM b_mail_consents WHERE person_id=? ORDER BY sequence DESC LIMIT 1),'')=?
    AND COALESCE((SELECT invalidated_at FROM b_mail_consents WHERE id=?),'')=?
    AND COALESCE((SELECT restored FROM b_mail_consents WHERE id=?),0)=?`,
    ...liveParams(actor, person.version), actor.id, before?.id ?? '', before?.id ?? '', before?.invalidated_at ?? '', before?.id ?? '', before?.restored ?? 0);
  const eventId = id(), at = now();
  try {
    await atomic(db, actor, [check, stmt(db, `INSERT INTO b_mail_consents(id,person_id,person_email,person_version,source,wording_version,wording,choice,actor_id,actor_email,at,sequence,key_digest,payload_digest)
      VALUES(?,?,?,?,'mail',?,?,?,?,?,?,?,?,?)`, eventId, actor.id, actor.email, person.version, VERSION, WORDING, body.choice, actor.id, actor.email, at, (before?.sequence ?? 0) + 1, key, payload),
      audit(db, actor, 'mail.choice_recorded', eventId, `${body.choice}; ${VERSION}; no provider access or connected processing`), done]);
  } catch (error) {
    if (error instanceof Fault && error.status === 409) { const winner = await receipt(); if (winner) return replay(winner); }
    throw error;
  }
  return mailConsent(db, actor);
}

/** Invalidation changes no original choice or attribution and never transfers to a successor. */
export function invalidateMailConsent(db: D1Database, address: string) {
  return stmt(db, "UPDATE b_mail_consents SET invalidated_at=?,invalidation_reason='Staff access ended; a fresh personal choice is required' WHERE person_email=? AND invalidated_at IS NULL", now(), address);
}
