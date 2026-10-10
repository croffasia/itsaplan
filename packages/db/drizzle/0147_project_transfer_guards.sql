-- A writer can validate the team before a transfer and commit afterwards. Check
-- team-bound references against the final project owner, including at transaction
-- commit: transfer remaps roles and changes the owner in the same transaction.
CREATE FUNCTION check_project_team_reference() RETURNS trigger AS $$
DECLARE
  r jsonb;
  owning_team integer;
  referenced_team integer;
BEGIN
  IF TG_TABLE_NAME = 'project_member' THEN
    SELECT to_jsonb(m) INTO r FROM project_member m
      WHERE m.project_id = NEW.project_id AND m.user_id = NEW.user_id;
  ELSE
    EXECUTE format('SELECT to_jsonb(r) FROM %I r WHERE id = $1', TG_TABLE_NAME)
      INTO r USING NEW.id;
  END IF;
  IF r IS NULL OR r->>'project_id' IS NULL THEN RETURN NULL; END IF;
  -- Completed runs and resolved invitations remain historical records of the source.
  IF TG_TABLE_NAME IN ('agent_run', 'team_invite') AND r->>'status' <> 'pending' THEN
    RETURN NULL;
  END IF;
  SELECT team_id INTO owning_team FROM project
    WHERE id = (r->>'project_id')::integer FOR SHARE;
  IF owning_team IS NULL THEN RETURN NULL; END IF;

  IF r->>'role_id' IS NOT NULL THEN
    SELECT team_id INTO referenced_team FROM team_role WHERE id = (r->>'role_id')::integer;
    IF referenced_team IS DISTINCT FROM owning_team THEN
      RAISE EXCEPTION 'Project role belongs to a different team' USING ERRCODE = '40001';
    END IF;
  END IF;
  IF TG_TABLE_NAME = 'project_member' THEN
    PERFORM 1 FROM team_member WHERE team_id = owning_team AND user_id = r->>'user_id' FOR KEY SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Project member no longer belongs to its team' USING ERRCODE = '40001';
    END IF;
    SELECT team_id INTO referenced_team FROM ai_agent WHERE user_id = r->>'user_id';
    IF referenced_team IS NOT NULL AND referenced_team <> owning_team THEN
      RAISE EXCEPTION 'Project agent belongs to a different team' USING ERRCODE = '40001';
    END IF;
  ELSIF TG_TABLE_NAME IN ('agent_schedule', 'agent_run') THEN
    SELECT team_id INTO referenced_team FROM ai_agent WHERE id = (r->>'agent_id')::integer;
    IF referenced_team IS DISTINCT FROM owning_team THEN
      RAISE EXCEPTION 'Project agent belongs to a different team' USING ERRCODE = '40001';
    END IF;
  ELSIF TG_TABLE_NAME = 'team_invite' THEN
    IF (r->>'team_id')::integer <> owning_team THEN
      RAISE EXCEPTION 'Project invitation belongs to a different team' USING ERRCODE = '40001';
    END IF;
  ELSIF TG_TABLE_NAME = 'git_managed_repository' THEN
    SELECT team_id INTO referenced_team FROM git_provider_connection
      WHERE id = (r->>'connection_id')::integer;
    IF referenced_team IS DISTINCT FROM owning_team THEN
      RAISE EXCEPTION 'Project repository connection belongs to a different team' USING ERRCODE = '40001';
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER project_member_team_reference
  AFTER INSERT OR UPDATE ON project_member DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION check_project_team_reference();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER team_invite_team_reference
  AFTER INSERT OR UPDATE ON team_invite DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION check_project_team_reference();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER agent_schedule_team_reference
  AFTER INSERT OR UPDATE ON agent_schedule DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION check_project_team_reference();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER agent_run_team_reference
  AFTER INSERT OR UPDATE ON agent_run DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION check_project_team_reference();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER git_managed_repository_team_reference
  AFTER INSERT OR UPDATE ON git_managed_repository DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION check_project_team_reference();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER scim_group_mapping_team_reference
  AFTER INSERT OR UPDATE ON scim_group_mapping DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION check_project_team_reference();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER project_action_team_reference
  AFTER INSERT OR UPDATE ON project_action DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION check_project_team_reference();
