ALTER TABLE "agent_run" ADD COLUMN "execution_started_at" timestamp with time zone;
--> statement-breakpoint
CREATE FUNCTION rev_agent_run() RETURNS trigger AS $$
DECLARE r agent_run%ROWTYPE;
BEGIN
  IF TG_OP = 'DELETE' THEN r := OLD; ELSE r := NEW; END IF;
  IF EXISTS (SELECT 1 FROM project WHERE id = r.project_id) THEN
    PERFORM bump_rev('runner-queue:' || r.project_id, r.project_id);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER agent_run_rev AFTER INSERT OR UPDATE OR DELETE ON agent_run
  FOR EACH ROW EXECUTE FUNCTION rev_agent_run();
