CREATE TABLE "project_document_issue" (
	"document_id" integer NOT NULL,
	"issue_id" integer NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_document_issue_document_id_issue_id_pk" PRIMARY KEY("document_id","issue_id")
);
--> statement-breakpoint
ALTER TABLE "project_document_issue" ADD CONSTRAINT "project_document_issue_document_id_project_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."project_document"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_document_issue" ADD CONSTRAINT "project_document_issue_issue_id_issue_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issue"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_document_issue" ADD CONSTRAINT "project_document_issue_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_document_issue_issue_idx" ON "project_document_issue" USING btree ("issue_id","document_id");
--> statement-breakpoint
CREATE FUNCTION project_document_issue_validate_project() RETURNS trigger AS $$
DECLARE
  document_project_id integer;
  issue_project_id integer;
BEGIN
  SELECT project_id INTO document_project_id FROM project_document WHERE id = NEW.document_id;
  SELECT project_id INTO issue_project_id FROM issue WHERE id = NEW.issue_id;
  IF document_project_id IS NULL OR issue_project_id IS NULL OR document_project_id <> issue_project_id THEN
    RAISE EXCEPTION 'A document and work item link must stay inside one project'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER project_document_issue_validate_project
BEFORE INSERT OR UPDATE ON project_document_issue
FOR EACH ROW EXECUTE FUNCTION project_document_issue_validate_project();
--> statement-breakpoint
CREATE FUNCTION project_document_issue_rev() RETURNS trigger AS $$
DECLARE
  row_document_id integer;
  row_issue_id integer;
  row_project_id integer;
BEGIN
  row_document_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.document_id ELSE NEW.document_id END;
  row_issue_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.issue_id ELSE NEW.issue_id END;
  SELECT project_id INTO row_project_id FROM project_document WHERE id = row_document_id;
  IF row_project_id IS NULL THEN
    SELECT project_id INTO row_project_id FROM issue WHERE id = row_issue_id;
  END IF;
  IF row_project_id IS NOT NULL THEN
    PERFORM bump_rev('documents:' || row_project_id, row_project_id);
    PERFORM bump_rev('issue:' || row_issue_id, row_project_id);
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER project_document_issue_rev
AFTER INSERT OR DELETE ON project_document_issue
FOR EACH ROW EXECUTE FUNCTION project_document_issue_rev();
