CREATE TABLE "issue_worklog" (
	"id" serial PRIMARY KEY NOT NULL,
	"issue_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"minutes" integer NOT NULL,
	"spent_on" date NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "issue_worklog_minutes_check" CHECK ("issue_worklog"."minutes" > 0)
);
--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "time_logging_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "issue_worklog" ADD CONSTRAINT "issue_worklog_issue_id_issue_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issue"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_worklog" ADD CONSTRAINT "issue_worklog_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "issue_worklog_issue_idx" ON "issue_worklog" USING btree ("issue_id","spent_on" DESC NULLS LAST);