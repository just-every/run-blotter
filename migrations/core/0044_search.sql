-- Firm-wide search (SEARCH-001). The text extracted from an uploaded document
-- (plain text, CSV, or the strings a PDF's content streams show), kept so a
-- search can match inside it. Derived from the stored bytes, so it is left out
-- of archives and deleted when the file's bytes are erased. Additive only.
CREATE TABLE b_file_text(
 file_id TEXT PRIMARY KEY REFERENCES b_files(id), text TEXT NOT NULL, extracted_at TEXT NOT NULL
);
