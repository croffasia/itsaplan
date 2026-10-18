CREATE TABLE "agent_pending_action" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" integer NOT NULL,
	"project_id" integer NOT NULL,
	"issue_id" integer,
	"run_id" integer,
	"tool" text NOT NULL,
	"args" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reason" text,
	"result" text,
	"decided_by_user_id" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_pending_action_status_check" CHECK ("agent_pending_action"."status" IN ('pending', 'approved', 'rejected', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "ai_agent" ADD COLUMN "require_approval" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_pending_action" ADD CONSTRAINT "agent_pending_action_agent_id_ai_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."ai_agent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_pending_action" ADD CONSTRAINT "agent_pending_action_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_pending_action" ADD CONSTRAINT "agent_pending_action_issue_id_issue_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issue"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_pending_action" ADD CONSTRAINT "agent_pending_action_run_id_agent_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_run"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_pending_action" ADD CONSTRAINT "agent_pending_action_decided_by_user_id_user_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_pending_action_agent_idx" ON "agent_pending_action" USING btree ("agent_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "agent_pending_action_issue_idx" ON "agent_pending_action" USING btree ("issue_id","status");