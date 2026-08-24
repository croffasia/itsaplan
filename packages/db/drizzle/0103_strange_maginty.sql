ALTER TABLE "issue" ADD COLUMN "estimate_points" numeric;--> statement-breakpoint
ALTER TABLE "issue" ADD COLUMN "estimate_minutes" integer;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "points_estimate_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "time_estimate_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "issue" ADD CONSTRAINT "issue_estimate_points_check" CHECK ("issue"."estimate_points" >= 0);--> statement-breakpoint
ALTER TABLE "issue" ADD CONSTRAINT "issue_estimate_minutes_check" CHECK ("issue"."estimate_minutes" >= 0);