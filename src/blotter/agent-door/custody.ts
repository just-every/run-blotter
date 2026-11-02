/** Until Base supplies atomic client-scoped capture/redaction, retain a native
 * installation-wide custody hold before admitting the first agent. SQL triggers
 * fence erasure racing admission; no decision evidence is silently discarded. */
export async function retainAgentEvidence(db:D1Database) {
 await db.prepare('INSERT INTO b_agent_door_custody(id,retained) VALUES(1,1) ON CONFLICT(id) DO UPDATE SET retained=1').run();
}
export const agentCustodyHeld=(db:D1Database)=>db.prepare('SELECT 1 FROM b_agent_door_custody WHERE id=1 AND retained=1').first();
