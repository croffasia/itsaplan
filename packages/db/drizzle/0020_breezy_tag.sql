CREATE TABLE "agent_run" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" integer NOT NULL,
	"issue_id" integer NOT NULL,
	"source_activity_id" integer,
	"prompt" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_run_status_check" CHECK ("agent_run"."status" IN ('pending', 'success', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "agent_run" ADD CONSTRAINT "agent_run_agent_id_ai_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."ai_agent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_run" ADD CONSTRAINT "agent_run_issue_id_issue_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issue"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_run" ADD CONSTRAINT "agent_run_source_activity_id_issue_activity_id_fk" FOREIGN KEY ("source_activity_id") REFERENCES "public"."issue_activity"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_run_due_idx" ON "agent_run" USING btree ("status","next_attempt_at");