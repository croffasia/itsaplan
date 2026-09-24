ALTER TABLE "project" DROP CONSTRAINT "project_key_unique";--> statement-breakpoint
ALTER TABLE "team" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_team_key_uq" UNIQUE("team_id","key");--> statement-breakpoint
ALTER TABLE "team" ADD CONSTRAINT "team_slug_unique" UNIQUE("slug");