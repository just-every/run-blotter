// Live ACCESS-002 grants. Keeping these predicates independent lets jobs,
// notifications and background dispatch use the same authority without sessions.
export function clientGrantSql(client: string, address: string, principal: string) {
  return `(${principal} OR (NOT EXISTS(SELECT 1 FROM b_access_members am WHERE am.email=${address} AND am.scoped=1)
    OR EXISTS(SELECT 1 FROM b_access_effective ae WHERE ae.email=${address} AND ae.client_id=${client})))`;
}
export const clientScopeSql = (client: string) => clientGrantSql(client, '?', "?='owner'");
export const clientScopeParams = (actor: {role:string;email:string}) => [actor.role, actor.email, actor.email];
export const sensitiveSql = (file: string, address: string, principal: string) => `(${principal} OR NOT EXISTS(SELECT 1 FROM b_sensitive_documents sd WHERE sd.file_key=${file})
  OR EXISTS(SELECT 1 FROM b_sensitive_grants sg WHERE sg.file_key=${file} AND sg.email=${address}))`;
export const quoted = (value: string) => "'" + value.replaceAll("'", "''") + "'";
