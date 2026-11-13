CREATE TABLE settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE schedule_entries (id TEXT PRIMARY KEY NOT NULL, date TEXT NOT NULL, start INTEGER NOT NULL, end INTEGER NOT NULL, kind TEXT NOT NULL DEFAULT 'block', note TEXT NOT NULL DEFAULT '', client TEXT NOT NULL DEFAULT '', active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, CHECK (start >= 540 AND end <= 1020 AND start < end), CHECK (kind IN ('block','appointment')));
--> statement-breakpoint
CREATE INDEX schedule_date_active ON schedule_entries(date, active);
