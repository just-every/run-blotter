-- Keep the existing MSG-001 firm name; the US-001 configuration is portable.
ALTER TABLE b_firm ADD COLUMN settings TEXT NOT NULL DEFAULT '{}';
