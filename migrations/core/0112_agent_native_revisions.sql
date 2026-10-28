-- Exact integer handles for the practice's native UUID revisions at the shared door.
-- Native services still compare their original revision inside the effect batch.
CREATE TABLE b_door_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  native_revision TEXT NOT NULL UNIQUE
);
