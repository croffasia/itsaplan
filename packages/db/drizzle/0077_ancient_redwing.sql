CREATE TABLE "calendar_connection" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"provider" text DEFAULT 'google' NOT NULL,
	"account_email" text NOT NULL,
	"tokens" jsonb NOT NULL,
	"scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"hidden_calendar_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "calendar_connection_member_unique" UNIQUE("project_id","user_id","provider"),
	CONSTRAINT "calendar_connection_provider_check" CHECK ("calendar_connection"."provider" IN ('google'))
);
--> statement-breakpoint
ALTER TABLE "calendar_connection" ADD CONSTRAINT "calendar_connection_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_connection" ADD CONSTRAINT "calendar_connection_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;