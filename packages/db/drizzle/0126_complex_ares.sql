CREATE TABLE "project_document_initiative" (
	"document_id" integer NOT NULL,
	"initiative_id" integer NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_document_initiative_document_id_initiative_id_pk" PRIMARY KEY("document_id","initiative_id")
);
--> statement-breakpoint
ALTER TABLE "project_document_initiative" ADD CONSTRAINT "project_document_initiative_document_id_project_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."project_document"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_document_initiative" ADD CONSTRAINT "project_document_initiative_initiative_id_initiative_id_fk" FOREIGN KEY ("initiative_id") REFERENCES "public"."initiative"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_document_initiative" ADD CONSTRAINT "project_document_initiative_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_document_initiative_initiative_idx" ON "project_document_initiative" USING btree ("initiative_id","document_id");--> statement-breakpoint
CREATE FUNCTION project_document_initiative_validate_project() RETURNS trigger AS $$
DECLARE
  document_project_id integer;
  initiative_project_id integer;
BEGIN
  SELECT project_id INTO document_project_id FROM project_document WHERE id = NEW.document_id;
  SELECT project_id INTO initiative_project_id FROM initiative WHERE id = NEW.initiative_id;
  IF document_project_id IS NULL OR initiative_project_id IS NULL OR document_project_id <> initiative_project_id THEN
    RAISE EXCEPTION 'A document and initiative link must stay inside one project'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER project_document_initiative_validate_project
BEFORE INSERT OR UPDATE ON project_document_initiative
FOR EACH ROW EXECUTE FUNCTION project_document_initiative_validate_project();
--> statement-breakpoint
CREATE FUNCTION project_document_initiative_rev() RETURNS trigger AS $$
DECLARE
  row_document_id integer;
  row_initiative_id integer;
  row_project_id integer;
BEGIN
  row_document_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.document_id ELSE NEW.document_id END;
  row_initiative_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.initiative_id ELSE NEW.initiative_id END;
  SELECT project_id INTO row_project_id FROM project_document WHERE id = row_document_id;
  IF row_project_id IS NULL THEN
    SELECT project_id INTO row_project_id FROM initiative WHERE id = row_initiative_id;
  END IF;
  IF row_project_id IS NOT NULL THEN
    PERFORM bump_rev('documents:' || row_project_id, row_project_id);
    PERFORM bump_rev('initiative:' || row_initiative_id, row_project_id);
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER project_document_initiative_rev
AFTER INSERT OR DELETE ON project_document_initiative
FOR EACH ROW EXECUTE FUNCTION project_document_initiative_rev();
