-- Capacity forecasts and hiring plans (CAPACITY-003). A manager saves a
-- scenario (its forecast window and its hypothetical hires, hours changes,
-- lost clients and service changes) to reopen and compare with the baseline.
-- The forecast itself is computed from live rules, actuals and capacity and is
-- never stored; saving a scenario changes no job, rule or capacity row. Additive only.
CREATE TABLE b_capacity_scenarios(
 id TEXT PRIMARY KEY, name TEXT NOT NULL, from_week TEXT NOT NULL, weeks INTEGER NOT NULL CHECK(weeks BETWEEN 1 AND 53),
 changes TEXT NOT NULL CHECK(json_valid(changes)), created_by TEXT NOT NULL, created_at TEXT NOT NULL
);
