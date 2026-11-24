ALTER TABLE "team" ADD COLUMN "sharing_selected" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "workspace" ADD COLUMN "sharing_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "workspace" ADD COLUMN "sharing_teams_only" boolean DEFAULT false NOT NULL;