// Maintained built-in releases plus reviewed, append-only release packages.
import { STARTER_LIBRARY, type StarterTemplate, type StarterVersion } from './starter-content';
import { releaseState } from './starter-diff';
import { templateWork } from './tasks';
import { render } from './messages';
import { atomic, audit, guard, human, insist, integer, lines, need, now, rows, stmt, text, type Actor, type Data } from './model';

export async function starterCatalog(db: D1Database): Promise<StarterTemplate[]> {
  const published = await rows(db, 'SELECT library_id,snapshot FROM b_starter_releases ORDER BY version');
  return STARTER_LIBRARY.map(t => ({ ...t, versions: [...t.versions, ...published.filter(p => p.library_id === t.id).map(p => JSON.parse(p.snapshot) as StarterVersion)] }));
}
export async function starter(db: D1Database, libraryId: string, version?: number) {
  const item = (await starterCatalog(db)).find(t => t.id === libraryId); insist(item, 'Starter template not found', 404);
  const release = version === undefined ? item.versions.at(-1)! : item.versions.find(v => v.version === version);
  insist(release, 'Library version not found', 404); return { item, release };
}
/** A principal can install a reviewed package from the maintainer; no adoption changes automatically. */
export async function publishStarter(db: D1Database, actor: Actor, body: Data) {
  human(actor); need(actor, 'owner');
  const libraryId = text(body.libraryId, 'Library template'), { release: prior } = await starter(db, libraryId);
  const input = body.release; insist(input && typeof input === 'object' && !Array.isArray(input), 'Supply a release package');
  const version = integer(input.version, 'Release version', 1, 1_000_000);
  insist(version > prior.version, 'Release versions are immutable; supply a newer version', 409);
  const source = text(body.source, 'Release source or change note', 500);
  insist(Array.isArray(input.tasks), 'Supply release tasks');
  insist(input.questions === undefined || (Array.isArray(input.questions) && input.questions.length === 0), 'Organizers are not available yet; PORTAL-004 carries them');
  const requests = lines(input.requests, 'Client document requests');
  await templateWork(db, { tasks: input.tasks, requests });
  insist(Array.isArray(input.messages) && input.messages.length > 0 && input.messages.length <= 10, 'Supply between one and ten messages');
  const messages = input.messages.map((m: Data) => {
    insist(m && typeof m === 'object', 'Supply a message');
    const message = { name: text(m.name, 'Message name', 120), subject: text(m.subject, 'Subject', 200), body: text(m.body, 'Message', 10_000) };
    render(message.subject, message.body, {}, undefined); return message;
  });
  const release: StarterVersion = { version, tasks: input.tasks, requests, questions: [], messages, budgetMinutes: integer(input.budgetMinutes, 'Budget minutes', 1, 100_000), description: text(input.description, 'Release description', 1000) };
  const keyed = releaseState(release);
  insist(Object.keys(keyed.tasks).length === release.tasks.length && Object.keys(keyed.requests).length === release.requests.length && Object.keys(keyed.messages).length === release.messages.length, 'Each task, request and message needs a distinct name');
  const [check, done] = guard(db, 'NOT EXISTS(SELECT 1 FROM b_starter_releases WHERE library_id=? AND version>?)', libraryId, prior.version);
  await atomic(db, actor, [check, stmt(db, 'INSERT INTO b_starter_releases(library_id,version,snapshot,source,published_by,published_at) VALUES(?,?,?,?,?,?)', libraryId, version, JSON.stringify(release), source, actor.email, now()), audit(db, actor, 'library.release_imported', libraryId, `version ${version}; ${source}`), done]);
  return { libraryId, version, source };
}
