// Separate, optional staff calendar choices. Evidence grants no provider access.
import { atomic, audit, digest, Fault, guard, id, insist, now, rows, stmt, type Actor, type Data } from './model';

const VERSION = 'calendar-time-1', SOURCE = 'calendar';
const WORDING = 'I allow my connected calendar events to be used for optional time suggestions. Private events must never be used, and no time may be recorded until I approve it. I can withdraw this choice at any time. Calendars are not connected and calendar suggestions remain unavailable. This choice grants no provider access and does not change my native work-action consent.';
const latest = (db: D1Database, actor: Actor) => stmt(db, 'SELECT * FROM b_calendar_consents WHERE person_email=? ORDER BY sequence DESC LIMIT 1', actor.email).first<Data>();
const current = (event: Data | null, actor: Actor) => Boolean(event && event.staff_id === actor.id && event.choice === 'opt_in' && !event.invalidated_at && !event.restored);
const reviewToken = (actor: Actor, event: Data | null) => digest(JSON.stringify([actor.id, actor.email, SOURCE, VERSION, WORDING, event?.id ?? null, event?.invalidated_at ?? null, event?.restored ?? 0]));
const evidence = (event: Data) => ({ id: event.id, staffId: event.staff_id, personEmail: event.person_email, source: event.source,
  wordingVersion: event.wording_version, wording: event.wording, choice: event.choice, actorId: event.actor_id, actor: event.actor, at: event.at,
  invalidatedAt: event.invalidated_at, invalidationReason: event.invalidation_reason, historical: Boolean(event.restored) });

// As for native time creation, verify the current session and factor inside the effect batch.
function sessionGuard(db: D1Database, actor: Actor) {
  return guard(db, `EXISTS(SELECT 1 FROM oa_sessions s JOIN oa_operators o ON o.id=s.operator_id
    WHERE s.id=? AND s.operator_id=? AND o.email=? AND o.status='active' AND s.revoked_at IS NULL AND s.expires_at>? AND s.operator_version=o.version)
    AND (EXISTS(SELECT 1 FROM b_enterprise_sessions s JOIN b_enterprise_connection c ON c.id=1 AND c.active=1 AND c.revision=s.revision
      JOIN b_enterprise_identities i ON i.id=s.identity_id AND i.active=1 AND i.blocked=0 WHERE s.session_id=? AND i.email=? AND s.mfa=1)
    OR ((NOT EXISTS(SELECT 1 FROM b_mfa_policy WHERE required=1) AND NOT EXISTS(SELECT 1 FROM b_mfa_factors WHERE email=? AND confirmed_at IS NOT NULL))
      OR (EXISTS(SELECT 1 FROM b_mfa_factors WHERE email=? AND confirmed_at IS NOT NULL) AND EXISTS(SELECT 1 FROM b_mfa_sessions WHERE session_id=? AND email=?))))`,
    actor.sessionId, actor.id, actor.email, Date.now(), actor.sessionId, actor.email, actor.email, actor.email, actor.sessionId, actor.email);
}
function staff(actor: Actor) {
  insist(actor.channel === 'person' && actor.sessionId && !actor.automation, 'A current native staff session is required', 403);
}

/** A staff member sees only their own current choice and attributed history. */
export async function calendarConsent(db: D1Database, actor: Actor) {
  staff(actor);
  const [session, done] = sessionGuard(db, actor);
  await atomic(db, actor, [session, done]);
  const event = await latest(db, actor);
  return { staffId: actor.id, personEmail: actor.email, source: SOURCE, wordingVersion: VERSION, wording: WORDING,
    reviewToken: await reviewToken(actor, event), lastId: event?.id ?? null, optedIn: current(event, actor),
    connected: false, suggestionsAvailable: false, providerAccessGranted: false,
    history: (await rows(db, 'SELECT * FROM b_calendar_consents WHERE person_email=? ORDER BY sequence DESC', actor.email)).map(evidence) };
}

/** A compare-and-set choice and digest-only replay key commit with their audit exactly once. */
export async function saveCalendarConsent(db: D1Database, actor: Actor, body: Data) {
  staff(actor);
  insist(!actor.readOnly, 'Read-only staff cannot record a choice', 403);
  insist(Object.keys(body).every(key => ['staffId','source','wordingVersion','choice','reviewToken','lastId','requestId'].includes(key)), 'Only your presented calendar choice fields are accepted');
  insist(body.staffId === actor.id, 'You can record only your own calendar choice', 403);
  insist(body.source === SOURCE && body.wordingVersion === VERSION, 'The calendar wording changed. Refresh and review it again.', 409);
  insist(['decline','opt_in','withdraw'].includes(body.choice), 'Choose whether to allow calendar time suggestions');
  insist(typeof body.requestId === 'string' && /^[A-Za-z0-9._:-]{1,128}$/.test(body.requestId), 'Supply a unique calendar choice request id');
  const key = await digest(body.requestId), payload = await digest(JSON.stringify([actor.id, SOURCE, VERSION, body.choice, body.lastId ?? null, body.reviewToken ?? null]));
  const receipt = () => stmt(db, 'SELECT * FROM b_calendar_consents WHERE staff_id=? AND key_digest=?', actor.id, key).first<Data>();
  const replay = async (saved: Data) => {
    insist(saved.payload_digest === payload, 'This calendar request was already used for a different choice', 409);
    const event = await latest(db, actor);
    insist(event?.id === saved.id && !saved.restored && !saved.invalidated_at, 'This calendar choice is historical. Review the current choice.', 409);
    return calendarConsent(db, actor);
  };
  const saved = await receipt();
  if (saved) return replay(saved);
  const before = await latest(db, actor);
  if (body.reviewToken !== await reviewToken(actor, before) || (body.lastId ?? null) !== (before?.id ?? null)) {
    const winner = await receipt();
    if (winner) return replay(winner);
    throw new Fault('Your calendar choice changed. Refresh and review it again.', 409);
  }
  const [live, done] = guard(db, `COALESCE((SELECT id FROM b_calendar_consents WHERE person_email=? ORDER BY sequence DESC LIMIT 1),'')=?
    AND COALESCE((SELECT invalidated_at FROM b_calendar_consents WHERE id=?),'')=?
    AND COALESCE((SELECT restored FROM b_calendar_consents WHERE id=?),0)=?`,
    actor.email, before?.id ?? '', before?.id ?? '', before?.invalidated_at ?? '', before?.id ?? '', before?.restored ?? 0);
  const [session, sessionDone] = sessionGuard(db, actor), eventId = id(), at = now();
  try {
    await atomic(db, actor, [session, live,
      stmt(db, `INSERT INTO b_calendar_consents(id,staff_id,person_email,source,wording_version,wording,choice,actor_id,actor,at,sequence,key_digest,payload_digest)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`, eventId, actor.id, actor.email, SOURCE, VERSION, WORDING, body.choice, actor.id, actor.email, at, (before?.sequence ?? 0) + 1, key, payload),
      audit(db, actor, 'calendar.choice_recorded', eventId, `${body.choice}; ${VERSION}; no provider access`), done, sessionDone]);
  } catch (error) {
    if (error instanceof Fault && error.status === 409) {
      const winner = await receipt();
      if (winner) return replay(winner);
    }
    throw error;
  }
  return calendarConsent(db, actor);
}

/** Deactivation is terminal for prior choices; a successor receives no consent. */
export const invalidateCalendarConsent = (db: D1Database, address: string) => stmt(db,
  "UPDATE b_calendar_consents SET invalidated_at=?,invalidation_reason='Staff deactivated; a fresh personal choice is required' WHERE person_email=? AND invalidated_at IS NULL", now(), address);
