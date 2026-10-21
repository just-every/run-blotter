-- Contact-merge consent (MSG-002 carried by CRM-004; ct 20 Oct 21:21Z): when two contacts merge,
-- the most restrictive consent wins. While the merge stands, the surviving contact's marketing
-- grants acted at or before the merge stop counting when the merged contact held no current
-- grant; a grant the contact gives later revives marketing. Undo deletes the merge's holds.
CREATE TABLE b_marketing_merge_holds(
 merge_id TEXT NOT NULL REFERENCES b_client_merges(id), contact_id TEXT NOT NULL REFERENCES b_client_contacts(id),
 merged_contact_id TEXT NOT NULL REFERENCES b_client_contacts(id), held_at TEXT NOT NULL,
 PRIMARY KEY(merge_id,contact_id)
);
CREATE INDEX b_marketing_merge_holds_contact ON b_marketing_merge_holds(contact_id,held_at);
