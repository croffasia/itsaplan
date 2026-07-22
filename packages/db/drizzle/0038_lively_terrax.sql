CREATE TABLE "notification_delivery" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"channel" text NOT NULL,
	"recipient" text,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_delivery_channel_check" CHECK ("notification_delivery"."channel" IN ('email', 'telegram'))
);
--> statement-breakpoint
ALTER TABLE "notification_delivery" ADD CONSTRAINT "notification_delivery_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notification_delivery_due_idx" ON "notification_delivery" USING btree ("next_attempt_at") WHERE "notification_delivery"."status" = 'pending';