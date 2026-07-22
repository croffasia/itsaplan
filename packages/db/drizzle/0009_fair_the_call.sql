CREATE TABLE "project_role" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"name" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"permissions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_role_project_id_name_unique" UNIQUE("project_id","name")
);
--> statement-breakpoint
ALTER TABLE "project_member" ADD COLUMN "role_id" integer;--> statement-breakpoint
ALTER TABLE "project_role" ADD CONSTRAINT "project_role_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "project_role_default_uq" ON "project_role" USING btree ("project_id") WHERE "project_role"."is_default";--> statement-breakpoint
CREATE INDEX "project_role_project_idx" ON "project_role" USING btree ("project_id");--> statement-breakpoint
ALTER TABLE "project_member" ADD CONSTRAINT "project_member_role_id_project_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."project_role"("id") ON DELETE set null ON UPDATE no action;