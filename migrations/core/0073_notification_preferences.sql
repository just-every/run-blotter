-- NOTIFY-001. Preferences and delivery journals are practice data, never credentials.
ALTER TABLE b_notifications ADD COLUMN read_at TEXT;
CREATE TABLE b_notification_settings(email TEXT PRIMARY KEY,settings TEXT NOT NULL CHECK(json_valid(settings)));
CREATE TABLE b_notification_defaults(id INTEGER PRIMARY KEY CHECK(id=1),settings TEXT NOT NULL CHECK(json_valid(settings)));
CREATE TABLE b_notification_digests(email TEXT NOT NULL,local_date TEXT NOT NULL,delivery TEXT NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(email,local_date));
