import { useEffect, useState } from 'react';
import { api, Empty, Field, Form, type Run } from './common';

type Connection = { tenant: string; required: 0 | 1; require_mfa: 0 | 1; active: 0 | 1 };
type Policy = { required: boolean; requireMfa: boolean };
type EnterpriseView = {
  configured: boolean;
  connection: Connection | null;
  mappings: { group_id: string; role: 'preparer' | 'reviewer'; team_id: string | null }[];
  identities: { id: string; email: string; subject: string; active: 0 | 1 }[];
  teams: { id: string; name: string }[];
};

/** Principal-only controls on the existing Team & safety screen. */
export function Enterprise({ run, tick }: { run: Run; tick: number }) {
  const [view, setView] = useState<EnterpriseView>(), [token, setToken] = useState('');
  const reload = async () => setView(await api('/enterprise'));
  useEffect(() => {
    let current = true;
    api('/enterprise').then(value => { if (current) setView(value); }).catch(error => run(async () => { throw error; }));
    return () => { current = false; };
  }, [tick]);
  if (!view) return null;
  const active = !!view.connection?.active;
  return <section className="panel wide" aria-label="Enterprise sign-in and provisioning" style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
    <h2>Enterprise sign-in</h2>
    <p className="muted">{active ? `Connected to Microsoft Entra tenant ${view.connection!.tenant}.` : view.configured ? 'Server credentials are configured. Enterprise sign-in is not active.' : 'Enterprise sign-in needs server configuration.'}</p>
    <p>The principal can always use native sign-in and recovery, including when enterprise sign-in is required for staff.</p>
    <details><summary>Connect Microsoft Entra</summary>
      <p>Ask your installation administrator to configure these server bindings: <code>ENTRA_TENANT_ID</code>, <code>ENTRA_CLIENT_ID</code>, <code>ENTRA_CLIENT_SECRET</code> and <code>ENTRA_TRANSACTION_SECRET</code>. Keep their values on the server.</p>
      <p>Register this installation’s origin followed by <code>/auth/oidc/enterprise/callback</code> as the application’s redirect URI. Activation verifies the server bindings.</p>
      {!active && <Form label="Activate enterprise sign-in" disabled={!view.configured} submit={async data => run(async () => {
        await api('/enterprise', { required: data.required === 'on', requireMfa: data.requireMfa === 'on', reason: data.reason });
        await reload();
      }, 'Enterprise sign-in activated')}>
        <label className="check"><input type="checkbox" name="required" /> Require enterprise sign-in for staff</label>
        <label className="check"><input type="checkbox" name="requireMfa" /> Require provider MFA</label>
        <Field label="Reason recorded in audit" name="reason" />
      </Form>}
    </details>
    {active && <>
      <details><summary>Staff sign-in policy</summary>
        <EnterprisePolicy connection={view.connection!} run={run} reload={reload} />
      </details>
      <details><summary>Sign in with Microsoft Entra</summary>
        <p>Continue in this browser to Microsoft Entra. The principal’s native recovery remains available.</p>
        <form method="post" action="/auth/oidc/enterprise/start"><button type="submit">Continue with Microsoft Entra</button></form>
      </details>
      <details><summary>Group roles and access teams</summary>
        {!view.mappings.length ? <Empty>No groups mapped yet.</Empty> : <table className="table">
          <thead><tr><th>Provider group</th><th>Role</th><th>Access team</th></tr></thead>
          <tbody>{view.mappings.map(m => <tr key={m.group_id}>
            <td data-label="Provider group">{m.group_id}</td><td data-label="Role">{m.role}</td>
            <td data-label="Access team">{m.team_id ? view.teams.find(t => t.id === m.team_id)?.name ?? m.team_id : 'No access team'}</td>
          </tr>)}</tbody>
        </table>}
        <Form label="Map group" submit={async data => run(async () => {
          await api('/enterprise/mappings', { groupId: data.groupId, role: data.role, teamId: data.teamId || undefined, reason: data.reason });
          await reload();
        }, 'Group mapping recorded')}>
          <Field label="Microsoft Entra group ID" name="groupId" />
          <Field label="Work role" name="role"><select name="role"><option value="preparer">Preparer</option><option value="reviewer">Reviewer</option></select></Field>
          <Field label="Access team (optional)" name="teamId"><select name="teamId"><option value="">No access team</option>{view.teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
          <Field label="Reason recorded in audit" name="reason" />
        </Form>
      </details>
      <details><summary>Bind staff identities</summary>
        <p>Invite and activate the staff member first in People and rates. Bind their existing email to the exact provider subject; this does not create a person or match people automatically.</p>
        {!view.identities.length ? <Empty>No staff identities bound yet.</Empty> : <table className="table">
          <thead><tr><th>Staff email</th><th>Provider subject</th><th>Status</th></tr></thead>
          <tbody>{view.identities.map(i => <tr key={i.id}><td data-label="Staff email">{i.email}</td><td data-label="Provider subject">{i.subject}</td><td data-label="Status">{i.active ? 'Active' : 'Deactivated'}</td></tr>)}</tbody>
        </table>}
        <Form label="Bind existing staff identity" submit={async data => run(async () => {
          await api('/enterprise/identities', { email: data.email, subject: data.subject, reason: data.reason });
          await reload();
        }, 'Staff identity bound')}>
          <Field label="Invited active staff email" name="email" type="email" />
          <Field label="Provider subject" name="subject" />
          <Field label="Reason recorded in audit" name="reason" />
        </Form>
      </details>
      <details onToggle={event => { if (!event.currentTarget.open) setToken(''); }}><summary>SCIM provisioning</summary>
        <p>Use this installation’s origin followed by <code>/scim/v2</code> as the SCIM base URL.</p>
        <Form label="Issue provisioning token" submit={async data => run(async () => {
          setToken('');
          const issued = await api('/enterprise/token', { reason: data.reason });
          setToken(issued.token);
        }, 'Provisioning token issued; copy it now')}>
          <Field label="Reason recorded in audit" name="reason" />
        </Form>
        {token && <div className="notice">
          <p>Copy this token to your provider now. It cannot be retrieved again. Closing this section dismisses it.</p>
          <Field label="Provisioning token (shown once)" name="provisioningToken"><input type="password" readOnly value={token} autoComplete="off" onFocus={event => event.currentTarget.select()} /></Field>
          <div className="actions"><button type="button" onClick={() => run(() => navigator.clipboard.writeText(token), 'Provisioning token copied')}>Copy provisioning token</button><button type="button" className="quiet" onClick={() => setToken('')}>Dismiss token</button></div>
        </div>}
      </details>
      <details><summary>Disconnect enterprise sign-in</summary>
        <p>Turn off this enterprise connection. The principal retains native sign-in and recovery.</p>
        <p>If enterprise sign-in is required, staff remain denied access until the principal reconnects or explicitly changes the sign-in policy.</p>
        <Form danger label="Disconnect enterprise sign-in" submit={async data => run(async () => {
          await api('/enterprise/disconnect', { reason: data.reason });
          setToken('');
          await reload();
        }, 'Enterprise sign-in disconnected')}>
          <Field label="Reason recorded in audit" name="reason" />
        </Form>
      </details>
    </>}
    <details><summary>Erase enterprise identity data</summary>
      <p>Permanently remove stored enterprise identity associations, group mappings and provisioning authority. Managed staff access is revoked. The principal’s native sign-in and recovery are kept.</p>
      <Form danger label="Erase enterprise identity data" submit={async data => run(async () => {
        await api('/enterprise/erase', { confirm: data.confirm, reason: data.reason });
        setToken('');
        await reload();
      }, 'Enterprise identity data erased; managed staff access revoked')}>
        <Field label="Type ERASE ENTERPRISE to confirm" name="confirm"><input name="confirm" required pattern="ERASE ENTERPRISE" autoComplete="off" /></Field>
        <Field label="Reason recorded in audit" name="reason" />
      </Form>
    </details>
  </section>;
}

function EnterprisePolicy({ connection, run, reload }: { connection: Connection; run: Run; reload: () => Promise<void> }) {
  const [policy, setPolicy] = useState<Policy>({ required: !!connection.required, requireMfa: !!connection.require_mfa });
  const [reason, setReason] = useState(''), [failed, setFailed] = useState(false);
  useEffect(() => {
    setPolicy({ required: !!connection.required, requireMfa: !!connection.require_mfa });
  }, [connection.required, connection.require_mfa]);
  const apply = async (next: Policy) => {
    setPolicy(next); setFailed(false);
    await run(async () => {
      try { await api('/enterprise', { ...next, reason: reason.trim() }); await reload(); }
      catch (error) { setFailed(true); throw error; }
    }, 'Saved');
  };
  return <>
    <Field label="Reason recorded in audit" name="enterprisePolicyReason" hint="Enter a reason, then change a policy. Changes save immediately.">
      <input name="enterprisePolicyReason" value={reason} onChange={event => setReason(event.target.value)} />
    </Field>
    <label className="check"><input type="checkbox" checked={policy.required} disabled={!reason.trim()} onChange={event => apply({ ...policy, required: event.target.checked })} /> Require enterprise sign-in for staff</label>
    <label className="check"><input type="checkbox" checked={policy.requireMfa} disabled={!reason.trim()} onChange={event => apply({ ...policy, requireMfa: event.target.checked })} /> Require provider MFA</label>
    {failed && <><p className="error" role="alert">The policy was not saved. Your selected values are kept for retry.</p><button type="button" disabled={!reason.trim()} onClick={() => apply(policy)}>Retry policy change</button></>}
  </>;
}
