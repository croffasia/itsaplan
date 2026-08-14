ALTER TABLE "project_column" ADD COLUMN "wip_limit" integer;--> statement-breakpoint
ALTER TABLE "project_column" ADD COLUMN "wip_mode" text DEFAULT 'soft' NOT NULL;--> statement-breakpoint
ALTER TABLE "project_column" ADD CONSTRAINT "project_column_wip_mode_check" CHECK ("project_column"."wip_mode" IN ('soft', 'hard'));--> statement-breakpoint
ALTER TABLE "project_column" ADD CONSTRAINT "project_column_wip_limit_check" CHECK ("project_column"."wip_limit" IS NULL OR "project_column"."wip_limit" > 0);