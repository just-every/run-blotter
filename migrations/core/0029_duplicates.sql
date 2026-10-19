-- Duplicate client proposals (CRM-004). Proposals are worked out when read from
-- the clients as they are now; a person may record that a proposed pair is not
-- a duplicate, with a reason, and that pair is not proposed again. Pairs are
-- stored with the smaller id first. Additive only, so older archives still restore.
CREATE TABLE b_duplicate_dismissals(
 client_a TEXT NOT NULL REFERENCES b_clients(id), client_b TEXT NOT NULL REFERENCES b_clients(id),
 reason TEXT NOT NULL, by_email TEXT NOT NULL, at TEXT NOT NULL,
 PRIMARY KEY(client_a,client_b), CHECK(client_a < client_b)
);
