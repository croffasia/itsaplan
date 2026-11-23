CREATE TABLE "git_issue_link" (
	"id" serial PRIMARY KEY NOT NULL,
	"repository_id" integer NOT NULL,
	"number" integer NOT NULL,
	"issue_id" integer,
	"url" text,
	"state" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "git_issue_link_issue_id_unique" UNIQUE("issue_id"),
	CONSTRAINT "git_issue_link_repository_id_number_unique" UNIQUE("repository_id","number")
);
--> statement-breakpoint
CREATE TABLE "git_repository_label" (
	"id" serial PRIMARY KEY NOT NULL,
	"repository_id" integer NOT NULL,
	"external_name" text NOT NULL,
	"label_id" integer,
	"type_id" integer,
	CONSTRAINT "git_repository_label_repository_id_external_name_unique" UNIQUE("repository_id","external_name")
);
--> statement-breakpoint
ALTER TABLE "git_managed_repository" ADD COLUMN "issue_sync" text DEFAULT 'off' NOT NULL;--> statement-breakpoint
ALTER TABLE "git_managed_repository" ADD COLUMN "issue_column_id" integer;--> statement-breakpoint
ALTER TABLE "git_managed_repository" ADD COLUMN "issue_comments" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "git_issue_link" ADD CONSTRAINT "git_issue_link_repository_id_git_managed_repository_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."git_managed_repository"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "git_issue_link" ADD CONSTRAINT "git_issue_link_issue_id_issue_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issue"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "git_repository_label" ADD CONSTRAINT "git_repository_label_repository_id_git_managed_repository_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."git_managed_repository"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "git_repository_label" ADD CONSTRAINT "git_repository_label_label_id_label_id_fk" FOREIGN KEY ("label_id") REFERENCES "public"."label"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "git_repository_label" ADD CONSTRAINT "git_repository_label_type_id_issue_type_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."issue_type"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "git_managed_repository" ADD CONSTRAINT "git_managed_repository_issue_column_id_project_column_id_fk" FOREIGN KEY ("issue_column_id") REFERENCES "public"."project_column"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE TRIGGER git_issue_link_rev AFTER INSERT OR UPDATE OR DELETE ON git_issue_link
  FOR EACH ROW EXECUTE FUNCTION rev_issue_child('issue_id', 'detail');
