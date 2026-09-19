ALTER TABLE "project_member" ADD COLUMN "is_favorite" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "project_member" ADD COLUMN "is_hidden" boolean DEFAULT false NOT NULL;