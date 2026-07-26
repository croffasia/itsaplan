ALTER TABLE "user_preference" ADD COLUMN "issue_stats_open" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user_preference" ADD COLUMN "issue_stats_view" text DEFAULT 'compact' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_preference" ADD CONSTRAINT "user_preference_issue_stats_view_check" CHECK ("user_preference"."issue_stats_view" IN ('compact', 'timeline'));