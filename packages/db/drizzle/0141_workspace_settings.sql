ALTER TABLE "workspace" ADD COLUMN "color" text;--> statement-breakpoint
ALTER TABLE "workspace" ADD COLUMN "team_creation" text DEFAULT 'owner' NOT NULL;--> statement-breakpoint
ALTER TABLE "workspace" ADD CONSTRAINT "workspace_team_creation_check" CHECK ("workspace"."team_creation" IN ('owner', 'managers', 'members'));