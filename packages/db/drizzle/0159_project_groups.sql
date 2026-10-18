CREATE TABLE "project_group" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#6b7280' NOT NULL,
	"position" double precision DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_group_member" (
	"group_id" integer NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "project_group_member_group_id_user_id_pk" PRIMARY KEY("group_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "issue" ADD COLUMN "assignee_group_id" integer;--> statement-breakpoint
ALTER TABLE "issue_template" ADD COLUMN "assignee_group_id" integer;--> statement-breakpoint
ALTER TABLE "project_group" ADD CONSTRAINT "project_group_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_group_member" ADD CONSTRAINT "project_group_member_group_id_project_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."project_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_group_member" ADD CONSTRAINT "project_group_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "project_group_project_name_uq" ON "project_group" USING btree ("project_id",lower("name"));--> statement-breakpoint
CREATE INDEX "project_group_member_user_idx" ON "project_group_member" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "issue" ADD CONSTRAINT "issue_assignee_group_id_project_group_id_fk" FOREIGN KEY ("assignee_group_id") REFERENCES "public"."project_group"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_template" ADD CONSTRAINT "issue_template_assignee_group_id_project_group_id_fk" FOREIGN KEY ("assignee_group_id") REFERENCES "public"."project_group"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "issue_assignee_group_idx" ON "issue" USING btree ("assignee_group_id") WHERE "issue"."assignee_group_id" IS NOT NULL;