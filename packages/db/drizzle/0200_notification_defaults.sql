CREATE TABLE "user_notification_default" (
	"user_id" text PRIMARY KEY NOT NULL,
	"email_events" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"telegram_events" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"slack_events" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"push_events" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_notification_default" ADD CONSTRAINT "user_notification_default_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;