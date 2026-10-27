-- Digest-only native time replay receipts are portable with the practice.
-- Keep the opaque entry reference after deletion so a retry cannot recreate it.
CREATE TABLE b_api_time_writes (
  actor_email TEXT NOT NULL,
  key_digest TEXT NOT NULL,
  payload_digest TEXT NOT NULL,
  entry_id TEXT NOT NULL,
  client_id TEXT NOT NULL REFERENCES b_clients(id),
  created_at TEXT NOT NULL,
  PRIMARY KEY(actor_email,key_digest)
);
CREATE INDEX b_api_time_writes_client ON b_api_time_writes(client_id);
