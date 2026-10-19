-- Merging duplicate clients (CRM-004). The merged client stays as a read-only
-- tombstone pointing at the survivor, so its source IDs and import identity stay
-- attached; its jobs, discussions, notices, expenses, recurring rules, rate cards
-- and group memberships move to the survivor with the exact ids recorded for undo.
-- A merge relaxes four immutability guards for one change only: a signed-off job,
-- an expense, a resolved discussion or a closed notice may change client_id, and
-- nothing else, between the two clients of a merge that is not undone.
-- Additive only, so older archives still restore.
ALTER TABLE b_clients ADD COLUMN merged_into TEXT REFERENCES b_clients(id);
CREATE TABLE b_client_merges(
 id TEXT PRIMARY KEY,
 survivor_id TEXT NOT NULL REFERENCES b_clients(id), merged_id TEXT NOT NULL REFERENCES b_clients(id),
 choices TEXT NOT NULL CHECK(json_valid(choices)), authority TEXT NOT NULL DEFAULT '',
 -- The survivor's own row before the merge (restored by undo), and the row its
 -- import last recorded (what a re-import of its source compares against).
 survivor_before TEXT NOT NULL CHECK(json_valid(survivor_before)), survivor_seen TEXT NOT NULL CHECK(json_valid(survivor_seen)),
 revision_after TEXT NOT NULL UNIQUE, moved TEXT NOT NULL CHECK(json_valid(moved)), linked_after TEXT NOT NULL CHECK(json_valid(linked_after)),
 merged_by TEXT NOT NULL, merged_at TEXT NOT NULL, undo_until TEXT NOT NULL, undone_by TEXT, undone_at TEXT,
 CHECK(survivor_id<>merged_id), CHECK((undone_by IS NULL)=(undone_at IS NULL))
);
CREATE UNIQUE INDEX b_client_merges_active ON b_client_merges(merged_id) WHERE undone_at IS NULL;
CREATE INDEX b_client_merges_survivor ON b_client_merges(survivor_id);
CREATE TRIGGER b_clients_merged BEFORE UPDATE ON b_clients WHEN OLD.merged_into IS NOT NULL AND NEW.merged_into IS NOT NULL
 BEGIN SELECT RAISE(ABORT,'merged clients are immutable'); END;
CREATE TRIGGER b_client_merges_history BEFORE UPDATE ON b_client_merges
 WHEN OLD.undone_at IS NOT NULL OR NEW.id IS NOT OLD.id OR NEW.survivor_id IS NOT OLD.survivor_id OR NEW.merged_id IS NOT OLD.merged_id
  OR NEW.choices IS NOT OLD.choices OR NEW.authority IS NOT OLD.authority OR NEW.survivor_before IS NOT OLD.survivor_before
  OR NEW.survivor_seen IS NOT OLD.survivor_seen OR NEW.revision_after IS NOT OLD.revision_after OR NEW.moved IS NOT OLD.moved
  OR NEW.linked_after IS NOT OLD.linked_after OR NEW.merged_by IS NOT OLD.merged_by OR NEW.merged_at IS NOT OLD.merged_at OR NEW.undo_until IS NOT OLD.undo_until
 BEGIN SELECT RAISE(ABORT,'merge history is immutable'); END;
CREATE TRIGGER b_client_merges_delete BEFORE DELETE ON b_client_merges BEGIN SELECT RAISE(ABORT,'merge history is immutable'); END;

-- What the client-list import sees for each client: the row it last recorded
-- while the only change since is a merge that kept this client.
CREATE VIEW b_client_import_rows AS SELECT c.id,
 CASE WHEN m.id IS NULL THEN c.revision ELSE json_extract(m.survivor_seen,'$.revision') END revision,
 CASE WHEN m.id IS NULL THEN c.name ELSE json_extract(m.survivor_seen,'$.name') END name,
 CASE WHEN m.id IS NULL THEN c.abn ELSE json_extract(m.survivor_seen,'$.abn') END abn,
 CASE WHEN m.id IS NULL THEN c.contact_name ELSE json_extract(m.survivor_seen,'$.contact_name') END contact_name,
 CASE WHEN m.id IS NULL THEN c.contact_email ELSE json_extract(m.survivor_seen,'$.contact_email') END contact_email,
 CASE WHEN m.id IS NULL THEN c.source ELSE json_extract(m.survivor_seen,'$.source') END source,
 CASE WHEN m.id IS NULL THEN c.fields ELSE json_extract(m.survivor_seen,'$.fields') END fields,
 CASE WHEN m.id IS NULL THEN c.tags ELSE json_extract(m.survivor_seen,'$.tags') END tags
 FROM b_clients c LEFT JOIN b_client_merges m ON m.survivor_id=c.id AND m.undone_at IS NULL AND m.revision_after=c.revision;

DROP TRIGGER b_jobs_signed_off;
CREATE TRIGGER b_jobs_signed_off BEFORE UPDATE ON b_jobs WHEN OLD.status='signed_off' AND NEW.client_id IS OLD.client_id
 BEGIN SELECT RAISE(ABORT,'signed-off jobs are immutable'); END;
CREATE TRIGGER b_jobs_client_move BEFORE UPDATE OF client_id ON b_jobs
 WHEN NEW.client_id IS NOT OLD.client_id AND (NOT EXISTS(SELECT 1 FROM b_client_merges m WHERE m.undone_at IS NULL
   AND ((m.survivor_id=NEW.client_id AND m.merged_id=OLD.client_id) OR (m.survivor_id=OLD.client_id AND m.merged_id=NEW.client_id))) OR (
 NEW.id IS NOT OLD.id OR NEW.template_id IS NOT OLD.template_id OR NEW.title IS NOT OLD.title
  OR NEW.period_start IS NOT OLD.period_start OR NEW.period_label IS NOT OLD.period_label
  OR NEW.due_date IS NOT OLD.due_date OR NEW.due_note IS NOT OLD.due_note
  OR NEW.preparer_email IS NOT OLD.preparer_email OR NEW.reviewer_email IS NOT OLD.reviewer_email
  OR NEW.status IS NOT OLD.status OR NEW.fee_cents IS NOT OLD.fee_cents OR NEW.rolled_from IS NOT OLD.rolled_from
  OR NEW.revision IS NOT OLD.revision OR NEW.created_by IS NOT OLD.created_by
  OR NEW.created_channel IS NOT OLD.created_channel OR NEW.created_at IS NOT OLD.created_at
  OR NEW.submitted_by IS NOT OLD.submitted_by OR NEW.submitted_at IS NOT OLD.submitted_at
  OR NEW.signed_off_by IS NOT OLD.signed_off_by OR NEW.signed_off_at IS NOT OLD.signed_off_at
  OR NEW.sign_off_note IS NOT OLD.sign_off_note OR NEW.manager_email IS NOT OLD.manager_email
  OR NEW.budget_minutes IS NOT OLD.budget_minutes))
 BEGIN SELECT RAISE(ABORT,'jobs move between clients only by a merge'); END;
DROP TRIGGER b_threads_resolved;
CREATE TRIGGER b_threads_resolved BEFORE UPDATE ON b_threads WHEN OLD.status='resolved' AND NEW.client_id IS OLD.client_id
 BEGIN SELECT RAISE(ABORT,'resolved threads are immutable'); END;
CREATE TRIGGER b_threads_client_move BEFORE UPDATE OF client_id ON b_threads
 WHEN NEW.client_id IS NOT OLD.client_id AND (NOT EXISTS(SELECT 1 FROM b_client_merges m WHERE m.undone_at IS NULL
   AND ((m.survivor_id=NEW.client_id AND m.merged_id=OLD.client_id) OR (m.survivor_id=OLD.client_id AND m.merged_id=NEW.client_id))) OR (
 NEW.id IS NOT OLD.id OR NEW.job_id IS NOT OLD.job_id OR NEW.anchor IS NOT OLD.anchor OR NEW.title IS NOT OLD.title
  OR NEW.kind IS NOT OLD.kind OR NEW.owner_email IS NOT OLD.owner_email OR NEW.follow_up_due IS NOT OLD.follow_up_due
  OR NEW.status IS NOT OLD.status OR NEW.resolution IS NOT OLD.resolution OR NEW.resolved_by IS NOT OLD.resolved_by
  OR NEW.resolved_at IS NOT OLD.resolved_at OR NEW.created_by IS NOT OLD.created_by
  OR NEW.created_at IS NOT OLD.created_at))
 BEGIN SELECT RAISE(ABORT,'discussions move between clients only by a merge'); END;
DROP TRIGGER b_notices_closed;
CREATE TRIGGER b_notices_closed BEFORE UPDATE ON b_notices WHEN OLD.status='closed' AND NEW.client_id IS OLD.client_id
 BEGIN SELECT RAISE(ABORT,'closed notices are immutable'); END;
CREATE TRIGGER b_notices_client_move BEFORE UPDATE OF client_id ON b_notices
 WHEN NEW.client_id IS NOT OLD.client_id AND (NOT EXISTS(SELECT 1 FROM b_client_merges m WHERE m.undone_at IS NULL
   AND ((m.survivor_id=NEW.client_id AND m.merged_id=OLD.client_id) OR (m.survivor_id=OLD.client_id AND m.merged_id=NEW.client_id))) OR (
 NEW.id IS NOT OLD.id OR NEW.job_id IS NOT OLD.job_id OR NEW.source_file_id IS NOT OLD.source_file_id
  OR NEW.agency IS NOT OLD.agency OR NEW.jurisdiction IS NOT OLD.jurisdiction OR NEW.notice_type IS NOT OLD.notice_type
  OR NEW.tax_period IS NOT OLD.tax_period OR NEW.notice_date IS NOT OLD.notice_date
  OR NEW.response_due IS NOT OLD.response_due OR NEW.due_verified_by IS NOT OLD.due_verified_by
  OR NEW.due_verified_at IS NOT OLD.due_verified_at OR NEW.assignee_email IS NOT OLD.assignee_email
  OR NEW.authorization IS NOT OLD.authorization OR NEW.plan IS NOT OLD.plan OR NEW.status IS NOT OLD.status
  OR NEW.outcome IS NOT OLD.outcome OR NEW.outcome_note IS NOT OLD.outcome_note
  OR NEW.evidence_event_id IS NOT OLD.evidence_event_id OR NEW.closed_by IS NOT OLD.closed_by
  OR NEW.closed_at IS NOT OLD.closed_at OR NEW.created_by IS NOT OLD.created_by OR NEW.created_at IS NOT OLD.created_at))
 BEGIN SELECT RAISE(ABORT,'notices move between clients only by a merge'); END;
DROP TRIGGER b_expenses_immutable;
CREATE TRIGGER b_expenses_immutable BEFORE UPDATE ON b_expenses
 WHEN NEW.id IS NOT OLD.id OR NEW.job_id IS NOT OLD.job_id OR NEW.kind IS NOT OLD.kind
 OR NEW.date IS NOT OLD.date OR NEW.description IS NOT OLD.description OR NEW.mile_tenths IS NOT OLD.mile_tenths
 OR NEW.cents_per_mile IS NOT OLD.cents_per_mile OR NEW.cost_cents IS NOT OLD.cost_cents OR NEW.billable IS NOT OLD.billable
 OR NEW.markup_percent IS NOT OLD.markup_percent OR NEW.charge_cents IS NOT OLD.charge_cents OR NEW.paid_by IS NOT OLD.paid_by
 OR NEW.person_email IS NOT OLD.person_email OR NEW.receipt_sha256 IS NOT OLD.receipt_sha256 OR NEW.receipt_base64 IS NOT OLD.receipt_base64
 OR (OLD.status<>'pending' AND NEW.status IS NOT OLD.status) OR (OLD.reimbursed_at IS NOT NULL AND NEW.client_id IS OLD.client_id)
 BEGIN SELECT RAISE(ABORT,'expenses are immutable'); END;
CREATE TRIGGER b_expenses_client_move BEFORE UPDATE OF client_id ON b_expenses
 WHEN NEW.client_id IS NOT OLD.client_id AND (NOT EXISTS(SELECT 1 FROM b_client_merges m WHERE m.undone_at IS NULL
   AND ((m.survivor_id=NEW.client_id AND m.merged_id=OLD.client_id) OR (m.survivor_id=OLD.client_id AND m.merged_id=NEW.client_id))) OR (
 NEW.id IS NOT OLD.id OR NEW.job_id IS NOT OLD.job_id OR NEW.kind IS NOT OLD.kind OR NEW.date IS NOT OLD.date
  OR NEW.description IS NOT OLD.description OR NEW.mile_tenths IS NOT OLD.mile_tenths
  OR NEW.cents_per_mile IS NOT OLD.cents_per_mile OR NEW.cost_cents IS NOT OLD.cost_cents
  OR NEW.billable IS NOT OLD.billable OR NEW.markup_percent IS NOT OLD.markup_percent
  OR NEW.charge_cents IS NOT OLD.charge_cents OR NEW.paid_by IS NOT OLD.paid_by
  OR NEW.person_email IS NOT OLD.person_email OR NEW.receipt_name IS NOT OLD.receipt_name
  OR NEW.receipt_mime IS NOT OLD.receipt_mime OR NEW.receipt_size IS NOT OLD.receipt_size
  OR NEW.receipt_sha256 IS NOT OLD.receipt_sha256 OR NEW.receipt_base64 IS NOT OLD.receipt_base64
  OR NEW.status IS NOT OLD.status OR NEW.decided_by IS NOT OLD.decided_by OR NEW.decided_at IS NOT OLD.decided_at
  OR NEW.reason IS NOT OLD.reason OR NEW.reimbursed_by IS NOT OLD.reimbursed_by
  OR NEW.reimbursed_at IS NOT OLD.reimbursed_at OR NEW.created_by IS NOT OLD.created_by
  OR NEW.created_at IS NOT OLD.created_at))
 BEGIN SELECT RAISE(ABORT,'expenses move between clients only by a merge'); END;
