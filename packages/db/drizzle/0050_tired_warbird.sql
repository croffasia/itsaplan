ALTER TABLE "project" ADD COLUMN "initiatives_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "dashboards_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "notes_enabled" boolean DEFAULT true NOT NULL;