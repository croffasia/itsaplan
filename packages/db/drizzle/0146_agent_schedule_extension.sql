ALTER TABLE "agent_run" DROP CONSTRAINT "agent_run_trigger_check";--> statement-breakpoint
ALTER TABLE "agent_schedule" DROP CONSTRAINT "agent_schedule_type_check";--> statement-breakpoint
ALTER TABLE "agent_schedule" ADD COLUMN "options" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_run" ADD CONSTRAINT "agent_run_trigger_check" CHECK ("agent_run"."trigger" IN ('mention', 'delegation', 'field', 'schedule', 'manual', 'status', 'event'));--> statement-breakpoint
ALTER TABLE "agent_schedule" ADD CONSTRAINT "agent_schedule_type_check" CHECK (("agent_schedule"."type" = 'cron' AND "agent_schedule"."cron" IS NOT NULL AND "agent_schedule"."next_run_at" IS NOT NULL AND "agent_schedule"."column_id" IS NULL)
        OR ("agent_schedule"."type" = 'status' AND "agent_schedule"."column_id" IS NOT NULL AND "agent_schedule"."cron" IS NULL AND "agent_schedule"."next_run_at" IS NULL)
        OR ("agent_schedule"."type" NOT IN ('cron', 'status') AND "agent_schedule"."cron" IS NULL AND "agent_schedule"."next_run_at" IS NULL AND "agent_schedule"."column_id" IS NULL));