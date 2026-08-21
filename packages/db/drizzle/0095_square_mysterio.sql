ALTER TABLE "agent_run" DROP CONSTRAINT "agent_run_trigger_check";--> statement-breakpoint
ALTER TABLE "agent_field_trigger" ADD COLUMN "delay_sec" integer DEFAULT 120 NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_field_trigger" ADD CONSTRAINT "agent_field_trigger_delay_check" CHECK ("agent_field_trigger"."delay_sec" >= 0 AND "agent_field_trigger"."delay_sec" <= 86400);--> statement-breakpoint
ALTER TABLE "agent_run" ADD CONSTRAINT "agent_run_trigger_check" CHECK ("agent_run"."trigger" IN ('mention', 'delegation', 'field', 'schedule', 'manual'));