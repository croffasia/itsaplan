CREATE TABLE "notification" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"project_id" integer NOT NULL,
	"issue_id" integer NOT NULL,
	"source_activity_id" integer,
	"type" text NOT NULL,
	"actor_user_id" text,
	"actor_name" text,
	"read_at" timestamp with time zone,
	"snoozed_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_type_check" CHECK ("notification"."type" IN ('assigned', 'mentioned', 'commented', 'state_changed'))
);
--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_issue_id_issue_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issue"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_source_activity_id_issue_activity_id_fk" FOREIGN KEY ("source_activity_id") REFERENCES "public"."issue_activity"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notification_user_idx" ON "notification" USING btree ("user_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "notification_user_unread_idx" ON "notification" USING btree ("user_id","id" DESC NULLS LAST) WHERE "notification"."read_at" IS NULL;