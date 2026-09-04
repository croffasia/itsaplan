CREATE TABLE "issue_development_check" (
	"id" serial PRIMARY KEY NOT NULL,
	"development_link_id" integer NOT NULL,
	"external_id" text NOT NULL,
	"app_id" text NOT NULL,
	"name" text NOT NULL,
	"status" text NOT NULL,
	"url" text,
	"head_sha" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "issue_development_check_development_link_id_app_id_name_unique" UNIQUE("development_link_id","app_id","name")
);
--> statement-breakpoint
CREATE TABLE "issue_development_link" (
	"id" serial PRIMARY KEY NOT NULL,
	"issue_id" integer NOT NULL,
	"provider" text NOT NULL,
	"repository" text NOT NULL,
	"number" integer NOT NULL,
	"title" text NOT NULL,
	"url" text,
	"state" text NOT NULL,
	"draft" boolean DEFAULT false NOT NULL,
	"source_branch" text,
	"target_branch" text NOT NULL,
	"head_sha" text,
	"pipeline_status" text,
	"pipeline_url" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "issue_development_link_issue_id_provider_repository_number_unique" UNIQUE("issue_id","provider","repository","number")
);
--> statement-breakpoint
ALTER TABLE "issue_development_check" ADD CONSTRAINT "issue_development_check_development_link_id_issue_development_link_id_fk" FOREIGN KEY ("development_link_id") REFERENCES "public"."issue_development_link"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_development_link" ADD CONSTRAINT "issue_development_link_issue_id_issue_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issue"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "issue_development_check_link_sha_idx" ON "issue_development_check" USING btree ("development_link_id","head_sha");--> statement-breakpoint
CREATE INDEX "issue_development_link_issue_idx" ON "issue_development_link" USING btree ("issue_id","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "issue_development_link_pr_idx" ON "issue_development_link" USING btree ("provider","repository","number");--> statement-breakpoint
CREATE INDEX "issue_development_link_sha_idx" ON "issue_development_link" USING btree ("provider","repository","head_sha");--> statement-breakpoint
CREATE FUNCTION rev_issue_development_check() RETURNS trigger AS $$
DECLARE
	link_id integer;
	target_id integer;
	p integer;
	i integer;
BEGIN
	IF TG_OP = 'DELETE' THEN link_id := OLD.development_link_id; ELSE link_id := NEW.development_link_id; END IF;
	SELECT l.issue_id, s.project_id, s.initiative_id INTO target_id, p, i
	FROM issue_development_link l JOIN issue s ON s.id = l.issue_id
	WHERE l.id = link_id;
	IF p IS NULL THEN RETURN NULL; END IF;
	PERFORM bump_rev('issue:' || target_id, p);
	IF i IS NOT NULL THEN PERFORM bump_rev('initiative:' || i, p); END IF;
	RETURN NULL;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER issue_development_link_rev AFTER INSERT OR UPDATE OR DELETE ON issue_development_link
	FOR EACH ROW EXECUTE FUNCTION rev_issue_child('issue_id', 'detail');--> statement-breakpoint
CREATE TRIGGER issue_development_check_rev AFTER INSERT OR UPDATE OR DELETE ON issue_development_check
	FOR EACH ROW EXECUTE FUNCTION rev_issue_development_check();
