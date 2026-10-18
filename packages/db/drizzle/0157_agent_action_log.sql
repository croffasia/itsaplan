CREATE TABLE "agent_action_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" integer NOT NULL,
	"project_id" integer NOT NULL,
	"issue_id" integer,
	"run_id" integer,
	"tool" text NOT NULL,
	"args" jsonb NOT NULL,
	"status" text NOT NULL,
	"error" text,
	"approved_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_action_log_status_check" CHECK ("agent_action_log"."status" IN ('success', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "agent_pending_action" DROP CONSTRAINT "agent_pending_action_status_check";--> statement-breakpoint
ALTER TABLE "agent_pending_action" ADD COLUMN "reported_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "agent_action_log" ADD CONSTRAINT "agent_action_log_agent_id_ai_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."ai_agent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_action_log" ADD CONSTRAINT "agent_action_log_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_action_log" ADD CONSTRAINT "agent_action_log_issue_id_issue_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issue"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_action_log" ADD CONSTRAINT "agent_action_log_run_id_agent_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_run"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_action_log" ADD CONSTRAINT "agent_action_log_approved_by_user_id_user_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_action_log_agent_idx" ON "agent_action_log" USING btree ("agent_id","created_at" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "agent_pending_action" ADD CONSTRAINT "agent_pending_action_status_check" CHECK ("agent_pending_action"."status" IN ('pending', 'applying', 'approved', 'rejected', 'failed', 'expired'));