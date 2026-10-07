ALTER TABLE "agent_run" DROP CONSTRAINT "agent_run_trigger_check";--> statement-breakpoint
ALTER TABLE "agent_schedule" ALTER COLUMN "cron" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_schedule" ALTER COLUMN "next_run_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_schedule" ADD COLUMN "type" text DEFAULT 'cron' NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_schedule" ADD COLUMN "column_id" integer;--> statement-breakpoint
ALTER TABLE "agent_schedule" ADD COLUMN "delay_sec" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_schedule" ADD CONSTRAINT "agent_schedule_column_id_project_column_id_fk" FOREIGN KEY ("column_id") REFERENCES "public"."project_column"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_schedule_column_idx" ON "agent_schedule" USING btree ("column_id");--> statement-breakpoint
ALTER TABLE "agent_run" ADD CONSTRAINT "agent_run_trigger_check" CHECK ("agent_run"."trigger" IN ('mention', 'delegation', 'field', 'schedule', 'manual', 'status'));--> statement-breakpoint
ALTER TABLE "agent_schedule" ADD CONSTRAINT "agent_schedule_type_check" CHECK (("agent_schedule"."type" = 'cron' AND "agent_schedule"."cron" IS NOT NULL AND "agent_schedule"."next_run_at" IS NOT NULL AND "agent_schedule"."column_id" IS NULL)
        OR ("agent_schedule"."type" = 'status' AND "agent_schedule"."column_id" IS NOT NULL AND "agent_schedule"."cron" IS NULL AND "agent_schedule"."next_run_at" IS NULL));--> statement-breakpoint
ALTER TABLE "agent_schedule" ADD CONSTRAINT "agent_schedule_delay_check" CHECK ("agent_schedule"."delay_sec" >= 0 AND "agent_schedule"."delay_sec" <= 86400);