-- Practitioner source mapping; the acknowledgment itself belongs to b_job_deadlines.
CREATE TABLE b_filing_status (
  job_id TEXT PRIMARY KEY REFERENCES b_jobs(id),
  client_id TEXT NOT NULL REFERENCES b_clients(id),
  form TEXT NOT NULL,
  jurisdiction TEXT NOT NULL,
  tax_year INTEGER NOT NULL,
  stack TEXT NOT NULL CHECK(stack IN ('Lacerte','ProSeries','Drake','UltraTax CS','CCH Axcess')),
  no_status_declaration TEXT,
  file_id TEXT NOT NULL REFERENCES b_files(id),
  file_sha256 TEXT NOT NULL,
  intent_sha256 TEXT,
  recorded_by TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  erased_at TEXT
);
