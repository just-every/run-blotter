-- External callers use existing agent keys; the app makes no provider request.
ALTER TABLE b_agent_rules ADD COLUMN mode TEXT NOT NULL DEFAULT 'native' CHECK(mode IN ('native','external'));
ALTER TABLE b_agent_rules ADD COLUMN provider_name TEXT NOT NULL DEFAULT 'None';
ALTER TABLE b_agent_rules ADD COLUMN model_name TEXT NOT NULL DEFAULT 'None';
ALTER TABLE b_agent_rules ADD COLUMN data_use TEXT NOT NULL DEFAULT 'No external model call';
ALTER TABLE b_agent_rules ADD COLUMN provider_retention TEXT NOT NULL DEFAULT 'No external provider copy';
ALTER TABLE b_agent_runs ADD COLUMN preparation_hash TEXT;
