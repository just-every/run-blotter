-- Shared-door preparations retain their native sponsor id across email changes.
-- Legacy SDK preparations keep their original native semantics.
ALTER TABLE b_proposals ADD COLUMN door_sponsor_id TEXT;
ALTER TABLE b_learning_proposals ADD COLUMN door_sponsor_id TEXT;
