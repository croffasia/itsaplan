CREATE TABLE "agent_schedule" (
	"id" serial PRIMARY KEY NOT NULL,
	"agent_id" integer NOT NULL,
	"name" text NOT NULL,
	"prompt" text NOT NULL,
	"cron" text NOT NULL,
	"timezone" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"next_run_at" timestamp with time zone NOT NULL,
	"last_run_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_schedule_agent_id_name_unique" UNIQUE("agent_id","name"),
	CONSTRAINT "agent_schedule_status_check" CHECK ("agent_schedule"."status" IN ('active', 'paused'))
);
--> statement-breakpoint
ALTER TABLE "agent_run" ALTER COLUMN "issue_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_run" ADD COLUMN "schedule_id" integer;--> statement-breakpoint
ALTER TABLE "agent_run" ADD COLUMN "trigger" text DEFAULT 'delegation' NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_run" ADD COLUMN "scheduled_for" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "agent_run" ADD COLUMN "output" text;--> statement-breakpoint
ALTER TABLE "agent_run" ADD COLUMN "started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "agent_run" ADD COLUMN "finished_at" timestamp with time zone;--> statement-breakpoint
UPDATE "agent_run" SET "trigger" = 'mention' WHERE "source_activity_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_schedule" ADD CONSTRAINT "agent_schedule_agent_id_ai_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."ai_agent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_schedule_due_idx" ON "agent_schedule" USING btree ("status","next_run_at");--> statement-breakpoint
CREATE INDEX "agent_schedule_agent_idx" ON "agent_schedule" USING btree ("agent_id");--> statement-breakpoint
ALTER TABLE "agent_run" ADD CONSTRAINT "agent_run_schedule_id_agent_schedule_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "public"."agent_schedule"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agent_run_schedule_fire_uq" ON "agent_run" USING btree ("schedule_id","scheduled_for");--> statement-breakpoint
CREATE INDEX "agent_run_schedule_idx" ON "agent_run" USING btree ("schedule_id");--> statement-breakpoint
ALTER TABLE "agent_run" ADD CONSTRAINT "agent_run_trigger_check" CHECK ("agent_run"."trigger" IN ('mention', 'delegation', 'schedule', 'manual'));
