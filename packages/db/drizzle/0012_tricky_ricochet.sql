CREATE TABLE "webhook" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"url" text NOT NULL,
	"secret" text NOT NULL,
	"events" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "webhook" ADD CONSTRAINT "webhook_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "webhook_project_idx" ON "webhook" USING btree ("project_id");