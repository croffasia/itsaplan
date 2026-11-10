ALTER TABLE "agent_run" DROP CONSTRAINT "agent_run_trigger_check";--> statement-breakpoint
ALTER TABLE "ai_agent" ADD COLUMN "trigger_on_review" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_run" ADD CONSTRAINT "agent_run_trigger_check" CHECK ("agent_run"."trigger" IN ('mention', 'delegation', 'field', 'review', 'schedule', 'manual', 'status', 'event'));