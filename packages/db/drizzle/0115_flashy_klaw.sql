CREATE TABLE "issue_template" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"title_template" text DEFAULT '' NOT NULL,
	"description_template" text DEFAULT '' NOT NULL,
	"type_id" integer,
	"column_id" integer,
	"priority" text,
	"assignee_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "issue_template_project_id_name_unique" UNIQUE("project_id","name")
);
--> statement-breakpoint
CREATE TABLE "issue_template_label" (
	"template_id" integer NOT NULL,
	"label_id" integer NOT NULL,
	CONSTRAINT "issue_template_label_template_id_label_id_pk" PRIMARY KEY("template_id","label_id")
);
--> statement-breakpoint
ALTER TABLE "issue_template" ADD CONSTRAINT "issue_template_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_template" ADD CONSTRAINT "issue_template_type_id_issue_type_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."issue_type"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_template" ADD CONSTRAINT "issue_template_column_id_project_column_id_fk" FOREIGN KEY ("column_id") REFERENCES "public"."project_column"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_template" ADD CONSTRAINT "issue_template_assignee_user_id_user_id_fk" FOREIGN KEY ("assignee_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_template_label" ADD CONSTRAINT "issue_template_label_template_id_issue_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."issue_template"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_template_label" ADD CONSTRAINT "issue_template_label_label_id_label_id_fk" FOREIGN KEY ("label_id") REFERENCES "public"."label"("id") ON DELETE cascade ON UPDATE no action;