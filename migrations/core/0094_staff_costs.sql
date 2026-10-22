-- BILL-003: what an hour of a person's time costs the practice, for client/job/service
-- profitability. Principal-only, audited, and never part of a billing rate or a client record.
CREATE TABLE b_staff_costs(
 id TEXT PRIMARY KEY, person_email TEXT NOT NULL, cost_cents INTEGER NOT NULL CHECK(cost_cents BETWEEN 0 AND 1000000),
 currency TEXT NOT NULL DEFAULT 'USD' CHECK(currency='USD'), effective_from TEXT NOT NULL, reason TEXT NOT NULL CHECK(reason<>''),
 set_by TEXT NOT NULL, set_at TEXT NOT NULL
);
CREATE INDEX b_staff_costs_person ON b_staff_costs(person_email,effective_from);
