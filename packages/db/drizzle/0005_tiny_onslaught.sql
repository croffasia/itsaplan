CREATE TABLE "project_dashboard" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"name" text NOT NULL,
	"icon" text,
	"layout" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"position" double precision DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_dashboard" ADD CONSTRAINT "project_dashboard_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_dashboard_project_idx" ON "project_dashboard" USING btree ("project_id","position");