-- API-002 replay metadata contains no request payload or bearer credential.
CREATE TABLE b_api_client_writes (
  actor_email TEXT NOT NULL,
  key_digest TEXT NOT NULL,
  payload_digest TEXT NOT NULL,
  client_id TEXT NOT NULL REFERENCES b_clients(id),
  created_at TEXT NOT NULL,
  PRIMARY KEY(actor_email,key_digest)
);
