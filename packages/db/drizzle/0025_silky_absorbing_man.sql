ALTER TABLE "issue" ADD COLUMN "delegate_user_id" text;--> statement-breakpoint
ALTER TABLE "issue" ADD CONSTRAINT "issue_delegate_user_id_user_id_fk" FOREIGN KEY ("delegate_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Split the overloaded assignee: where an issue was assigned to an agent bot user,
-- move that value into delegate and clear assignee. Assignee now holds members only.
UPDATE "issue" SET "delegate_user_id" = "assignee_user_id", "assignee_user_id" = NULL
WHERE "assignee_user_id" IN (SELECT "user_id" FROM "ai_agent");