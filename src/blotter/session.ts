// Who is calling: a signed-in person (native session) or an agent key.
import { operatorAuth, runtimeBindings, type Bindings } from '../auth.server';
import { digest, insist, stmt, type Actor, type Role } from './model';

export async function person(request: Request, original: Bindings): Promise<Actor> {
  const env = runtimeBindings(original), url = new URL(request.url);
  insist(url.origin === env.AUTH_ORIGIN, 'Invalid host', 403);
  if (!['GET', 'HEAD'].includes(request.method)) {
    insist(request.headers.get('origin') === env.AUTH_ORIGIN && request.headers.get('sec-fetch-site') !== 'cross-site', 'Invalid request origin', 403);
  }
  const session = await operatorAuth(env).getSession(request);
  insist(session, 'Sign in to continue', 401);
  const o = session.operator;
  const member = await stmt(env.DB, 'SELECT role FROM b_members WHERE email=? AND active=1', o.email).first<{ role: Role }>();
  const role = o.role === 'owner' ? 'owner' : member?.role;
  insist(role, 'Ask the principal to add you to the practice', 403);
  return { id: o.id, email: o.email, name: o.displayName, role, channel: 'person' };
}

export async function agent(request: Request, env: Bindings): Promise<Actor> {
  const raw = request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
  insist(raw, 'An agent key is required', 401);
  const record = await stmt(env.DB, `SELECT k.label,o.id,o.email,o.display_name,o.role,m.role member_role FROM b_agent_keys k
    JOIN oa_operators o ON o.id=k.owner_id LEFT JOIN b_members m ON m.email=o.email AND m.active=1
    WHERE k.digest=? AND k.revoked=0 AND o.status='active'`, await digest(raw)).first<any>();
  insist(record, 'Invalid or revoked agent key', 401);
  const role = record.role === 'owner' ? 'owner' : record.member_role;
  insist(role, 'This agent no longer has practice access', 403);
  return { id: record.id, email: record.email, name: record.display_name, role, channel: 'agent', label: record.label };
}
