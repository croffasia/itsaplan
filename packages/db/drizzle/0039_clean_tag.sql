CREATE TABLE "user_notification_preference" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"project_id" integer NOT NULL,
	"email_events" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"telegram_events" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"telegram_chat_id" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_notification_pref_user_project_unique" UNIQUE("user_id","project_id")
);
--> statement-breakpoint
ALTER TABLE "user_notification_preference" ADD CONSTRAINT "user_notification_preference_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_notification_preference" ADD CONSTRAINT "user_notification_preference_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;