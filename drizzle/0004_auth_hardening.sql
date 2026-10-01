ALTER TABLE staff ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE staff ADD COLUMN failed_login_count INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE staff ADD COLUMN locked_until TEXT;
--> statement-breakpoint
ALTER TABLE staff ADD COLUMN last_login_at TEXT;
