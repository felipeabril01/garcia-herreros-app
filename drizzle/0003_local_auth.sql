ALTER TABLE staff ADD COLUMN username TEXT;
--> statement-breakpoint
ALTER TABLE staff ADD COLUMN password_hash TEXT;
--> statement-breakpoint
ALTER TABLE staff ADD COLUMN password_salt TEXT;
--> statement-breakpoint
ALTER TABLE staff ADD COLUMN password_iterations INTEGER;
--> statement-breakpoint
ALTER TABLE staff ADD COLUMN password_updated_at TEXT;
--> statement-breakpoint
CREATE UNIQUE INDEX staff_username_unique ON staff(username);
--> statement-breakpoint
CREATE TABLE auth_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  staff_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  FOREIGN KEY (staff_id) REFERENCES staff(id) ON UPDATE no action ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX auth_sessions_token_unique ON auth_sessions(token_hash);
--> statement-breakpoint
CREATE INDEX auth_sessions_staff_idx ON auth_sessions(staff_id);
--> statement-breakpoint
CREATE INDEX auth_sessions_expires_idx ON auth_sessions(expires_at);
