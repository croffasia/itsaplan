ALTER TABLE "project" ADD COLUMN "subtasks_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "checklists_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "issue_stats_enabled" boolean DEFAULT true NOT NULL;