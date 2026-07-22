ALTER TABLE "assignee" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "assignee" CASCADE;--> statement-breakpoint
ALTER TABLE "issue" DROP COLUMN "assignee_id";--> statement-breakpoint
ALTER TABLE "issue_activity" DROP COLUMN "actor_id";
