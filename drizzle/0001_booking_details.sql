ALTER TABLE schedule_entries ADD COLUMN status TEXT NOT NULL DEFAULT 'confirmed';
--> statement-breakpoint
ALTER TABLE schedule_entries ADD COLUMN services TEXT NOT NULL DEFAULT '[]';
--> statement-breakpoint
ALTER TABLE schedule_entries ADD COLUMN total INTEGER NOT NULL DEFAULT 0;
