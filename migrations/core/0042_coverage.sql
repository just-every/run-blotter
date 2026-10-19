-- CAPACITY-002 coverage plans. A manager (a reviewer or the principal)
-- approves a previewed plan that moves an absent or overloaded person's work to
-- eligible colleagues and dates; work no one can cover is kept as a conflict
-- the approving manager owns until it is resolved or handed on. Additive only.
CREATE TABLE b_coverage_plans(
 id TEXT PRIMARY KEY, person_email TEXT NOT NULL, reason TEXT NOT NULL CHECK(reason IN ('leave','overload')),
 starts_on TEXT NOT NULL, ends_on TEXT NOT NULL, lines TEXT NOT NULL CHECK(json_valid(lines)),
 approved_by TEXT NOT NULL, approved_at TEXT NOT NULL
);
CREATE TABLE b_coverage_conflicts(
 id TEXT PRIMARY KEY, plan_id TEXT NOT NULL REFERENCES b_coverage_plans(id), job_id TEXT NOT NULL REFERENCES b_jobs(id),
 reason TEXT NOT NULL, owner_email TEXT NOT NULL, created_at TEXT NOT NULL,
 resolved_by TEXT, resolved_at TEXT, resolution TEXT,
 CHECK((resolved_at IS NULL) = (resolved_by IS NULL))
);
CREATE INDEX b_coverage_conflicts_job ON b_coverage_conflicts(job_id);
