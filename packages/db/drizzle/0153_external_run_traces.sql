CREATE TABLE "agent_run_trace" (
	"run_id" integer NOT NULL,
	"attempt" integer NOT NULL,
	"session_id" text,
	"events" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"next_offset" integer DEFAULT 0 NOT NULL,
	"truncated" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_run_trace_run_id_attempt_pk" PRIMARY KEY("run_id","attempt")
);
--> statement-breakpoint
ALTER TABLE "agent_run_trace" ADD CONSTRAINT "agent_run_trace_run_id_agent_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_run"("id") ON DELETE cascade ON UPDATE no action;