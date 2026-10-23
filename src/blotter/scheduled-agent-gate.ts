export const liveAgentRuleSql = `EXISTS(SELECT 1 FROM b_agent_rules r JOIN b_agent_keys k ON k.id=r.key_id JOIN oa_operators o ON o.id=r.supervisor_id JOIN b_jobs j ON j.id=? JOIN b_clients c ON c.id=j.client_id
 WHERE r.id=? AND r.status='active' AND k.revoked=0 AND k.owner_id=o.id AND o.status='active' AND o.role='owner' AND o.email=r.supervisor_email AND c.id=r.client_id AND c.lifecycle='active' AND c.merged_into IS NULL AND c.erased_at IS NULL
 AND (COALESCE((SELECT required FROM b_mfa_policy WHERE id=1),0)=0 OR EXISTS(SELECT 1 FROM b_mfa_factors WHERE email=o.email AND confirmed_at IS NOT NULL))
 AND (? NOT LIKE 'file:%' OR EXISTS(SELECT 1 FROM b_files f WHERE f.id=substr(?,6) AND f.erased_at IS NULL)))`;
