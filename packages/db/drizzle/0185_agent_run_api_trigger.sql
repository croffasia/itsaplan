ALTER TABLE "agent_run" DROP CONSTRAINT "agent_run_trigger_check";--> statement-breakpoint
<<<<<<<< HEAD:packages/db/drizzle/0185_agent_run_api_trigger.sql
ALTER TABLE "agent_run" ADD CONSTRAINT "agent_run_trigger_check" CHECK ("agent_run"."trigger" IN ('mention', 'delegation', 'field', 'schedule', 'manual', 'status', 'event', 'api'));
|||||||| parent of 47a52cad (feat: a review runs the agent only when it opts in and the reviewer may write):packages/db/drizzle/0177_agent_run_review_trigger.sql
ALTER TABLE "agent_run" ADD CONSTRAINT "agent_run_trigger_check" CHECK ("agent_run"."trigger" IN ('mention', 'delegation', 'field', 'review', 'schedule', 'manual', 'status', 'event'));
========
ALTER TABLE "ai_agent" ADD COLUMN "trigger_on_review" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_run" ADD CONSTRAINT "agent_run_trigger_check" CHECK ("agent_run"."trigger" IN ('mention', 'delegation', 'field', 'review', 'schedule', 'manual', 'status', 'event'));
>>>>>>>> 47a52cad (feat: a review runs the agent only when it opts in and the reviewer may write):packages/db/drizzle/0177_agent_review_trigger.sql