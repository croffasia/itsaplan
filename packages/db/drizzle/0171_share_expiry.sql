ALTER TABLE "issue" ADD COLUMN "share_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "project_view" ADD COLUMN "share_expires_at" timestamp with time zone;