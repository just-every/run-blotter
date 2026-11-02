import { audit, guard, id, stmt, type Actor } from './model';

/** Recompute only enterprise-managed team grants. Direct principal grants remain separate. */
export function enterpriseRefresh(db:D1Database,actor:Actor) {
  const managed="SELECT i.email FROM b_enterprise_identities i WHERE NOT EXISTS(SELECT 1 FROM oa_operators p WHERE p.email=i.email AND p.role='owner')";
  return [
    stmt(db,'UPDATE b_enterprise_connection SET revision=revision+1 WHERE id=1'),
    stmt(db,'DELETE FROM b_access_team_members WHERE EXISTS(SELECT 1 FROM b_enterprise_team_grants g WHERE g.team_id=b_access_team_members.team_id AND g.email=b_access_team_members.email)'),
    stmt(db,'DELETE FROM b_enterprise_team_grants'),
    stmt(db,`INSERT INTO b_access_members(email) ${managed} ON CONFLICT DO NOTHING`),
    stmt(db,`UPDATE b_members SET active=CASE WHEN EXISTS(SELECT 1 FROM b_enterprise_identities i JOIN b_enterprise_group_members gm ON gm.identity_id=i.id JOIN b_enterprise_mappings m ON m.group_id=gm.group_id WHERE i.email=b_members.email AND i.active=1 AND i.blocked=0) THEN 1 ELSE 0 END,
      role=COALESCE((SELECT CASE WHEN count(*)=0 OR min(CASE m.role WHEN 'preparer' THEN 0 ELSE 1 END)=0 THEN 'preparer' ELSE 'reviewer' END FROM b_enterprise_identities i JOIN b_enterprise_group_members gm ON gm.identity_id=i.id JOIN b_enterprise_mappings m ON m.group_id=gm.group_id WHERE i.email=b_members.email AND i.active=1 AND i.blocked=0),'preparer') WHERE email IN(${managed})`),
    stmt(db,`INSERT OR IGNORE INTO b_enterprise_team_grants(team_id,email) SELECT m.team_id,i.email FROM b_enterprise_mappings m JOIN b_enterprise_group_members gm ON gm.group_id=m.group_id JOIN b_enterprise_identities i ON i.id=gm.identity_id WHERE m.team_id IS NOT NULL AND i.active=1 AND i.blocked=0 AND NOT EXISTS(SELECT 1 FROM oa_operators p WHERE p.email=i.email AND p.role='owner') AND NOT EXISTS(SELECT 1 FROM b_access_team_members x WHERE x.team_id=m.team_id AND x.email=i.email)`),
    stmt(db,`INSERT OR IGNORE INTO b_access_team_members(team_id,email) SELECT team_id,email FROM b_enterprise_team_grants`),
    stmt(db,"UPDATE oa_sessions SET revoked_at=? WHERE revoked_at IS NULL AND operator_id IN(SELECT o.id FROM oa_operators o JOIN b_enterprise_identities i ON i.email=o.email WHERE o.role<>'owner')",Date.now()),
    stmt(db,`UPDATE b_mail_consents SET invalidated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'),invalidation_reason='Enterprise authority changed; a fresh personal choice is required' WHERE invalidated_at IS NULL AND person_email IN(${managed})`),
    stmt(db,`UPDATE oa_operators SET version=version+1 WHERE email IN(${managed})`),
    stmt(db,"UPDATE b_agent_keys SET revoked=1 WHERE owner_id IN(SELECT o.id FROM oa_operators o JOIN b_enterprise_identities i ON i.email=o.email WHERE o.role<>'owner')"),
    stmt(db,'DELETE FROM b_enterprise_sessions'),
    stmt(db,'INSERT INTO b_access_policy(id,revision) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET revision=excluded.revision',id()),
    audit(db,actor,'enterprise.lifecycle_applied','enterprise','Mapped roles and teams refreshed; managed sessions and credentials revoked'),
  ];
}
export function enterpriseGuard(db:D1Database,revision:number) {
  const [check,release]=guard(db,"EXISTS(SELECT 1 FROM b_enterprise_connection c JOIN oa_operators p ON p.id=c.principal_id AND p.role='owner' AND p.status='active' WHERE c.id=1 AND c.active=1 AND c.revision=?)",revision);
  return {check,release};
}
