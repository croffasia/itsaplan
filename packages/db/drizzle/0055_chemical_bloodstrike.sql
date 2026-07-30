ALTER TABLE "agent_run" DROP CONSTRAINT "agent_run_schedule_id_agent_schedule_id_fk";
--> statement-breakpoint
ALTER TABLE "agent_run" ADD CONSTRAINT "agent_run_schedule_id_agent_schedule_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."agent_schedule"("id") ON DELETE cascade ON UPDATE no action;