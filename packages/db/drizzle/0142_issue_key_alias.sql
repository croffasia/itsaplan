CREATE TABLE "issue_key_alias" (
	"project_id" integer NOT NULL,
	"sequence_number" integer NOT NULL,
	"issue_id" integer NOT NULL,
	CONSTRAINT "issue_key_alias_project_id_sequence_number_pk" PRIMARY KEY("project_id","sequence_number")
);
--> statement-breakpoint
ALTER TABLE "issue_key_alias" ADD CONSTRAINT "issue_key_alias_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_key_alias" ADD CONSTRAINT "issue_key_alias_issue_id_issue_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issue"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "issue_key_alias_issue_idx" ON "issue_key_alias" USING btree ("issue_id");--> statement-breakpoint
-- An issue moved to another project changes both boards, taken in id order like two
-- initiatives are, and its own scope follows it to the project whose members read it.
CREATE OR REPLACE FUNCTION rev_issue() RETURNS trigger AS $$
DECLARE
  r issue%ROWTYPE;
  lo integer;
  hi integer;
BEGIN
  IF TG_OP = 'DELETE' THEN r := OLD; ELSE r := NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.project_id <> NEW.project_id THEN
    PERFORM bump_rev('board:' || least(OLD.project_id, NEW.project_id), least(OLD.project_id, NEW.project_id));
    PERFORM bump_rev('board:' || greatest(OLD.project_id, NEW.project_id), greatest(OLD.project_id, NEW.project_id));
    UPDATE revision SET project_id = NEW.project_id WHERE scope = 'issue:' || r.id;
  ELSE
    PERFORM bump_rev('board:' || r.project_id, r.project_id);
  END IF;
  IF TG_OP = 'DELETE' THEN
    DELETE FROM revision WHERE scope = 'issue:' || r.id;
  ELSE
    PERFORM bump_rev('issue:' || r.id, r.project_id);
  END IF;
  -- An issue that moved between initiatives changes both: the one it left no longer
  -- shows it. The two counters are taken in id order, so two issues moving between
  -- the same initiatives in opposite directions cannot deadlock. least/greatest skip
  -- a NULL side, which leaves a plain add or removal with one id in lo.
  IF TG_OP = 'UPDATE' AND OLD.initiative_id IS DISTINCT FROM NEW.initiative_id THEN
    lo := least(OLD.initiative_id, NEW.initiative_id);
    hi := greatest(OLD.initiative_id, NEW.initiative_id);
  ELSE
    lo := r.initiative_id;
  END IF;
  IF lo IS NOT NULL THEN PERFORM bump_rev('initiative:' || lo, r.project_id); END IF;
  IF hi IS NOT NULL AND hi <> lo THEN PERFORM bump_rev('initiative:' || hi, r.project_id); END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
