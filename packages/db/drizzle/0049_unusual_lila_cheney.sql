ALTER TABLE "issue" ADD COLUMN "share_token" uuid;--> statement-breakpoint
ALTER TABLE "project_view" ADD COLUMN "share_token" uuid;--> statement-breakpoint
ALTER TABLE "issue" ADD CONSTRAINT "issue_share_token_unique" UNIQUE("share_token");--> statement-breakpoint
ALTER TABLE "project_view" ADD CONSTRAINT "project_view_share_token_unique" UNIQUE("share_token");