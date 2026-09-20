CREATE TABLE "project_mail_summary" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"message_key" text NOT NULL,
	"summary" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_mail_summary_key_unique" UNIQUE("project_id","message_key")
);
--> statement-breakpoint
ALTER TABLE "project_mail_summary" ADD CONSTRAINT "project_mail_summary_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;