-- Custom SQL migration file, put your code below! --
-- The revision engine: the counters in `revision` are moved by these triggers, so
-- a write moves the marker whichever process it came from (api, worker, bot, mcp,
-- or hand-written SQL).
--
-- Scope names: 'board:<projectId>' (the work items board), 'issue:<issueId>' and
-- 'initiative:<initiativeId>' (their detail screens), 'inbox:<projectId>:<userId>'
-- (a user's notifications in one project).
--
-- Every function takes the scope rows in the same order — board, then issue, then
-- initiative — so two concurrent writers can never hold them the other way round
-- and deadlock.

CREATE FUNCTION bump_rev(p_scope text, p_project_id integer) RETURNS void AS $$
  INSERT INTO revision (scope, project_id, rev) VALUES (p_scope, p_project_id, 1)
  ON CONFLICT (scope) DO UPDATE SET rev = revision.rev + 1;
$$ LANGUAGE sql;
--> statement-breakpoint

CREATE FUNCTION rev_issue() RETURNS trigger AS $$
DECLARE
  r issue%ROWTYPE;
  lo integer;
  hi integer;
BEGIN
  IF TG_OP = 'DELETE' THEN r := OLD; ELSE r := NEW; END IF;
  PERFORM bump_rev('board:' || r.project_id, r.project_id);
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
--> statement-breakpoint

-- Rows that belong to an issue. TG_ARGV[0] is the column holding the issue id;
-- TG_ARGV[1] is 'board' when the change shows on the board, 'detail' when only the
-- issue screen shows it.
CREATE FUNCTION rev_issue_child() RETURNS trigger AS $$
DECLARE
  target_id integer;
  p integer;
  i integer;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_id := (to_jsonb(OLD) ->> TG_ARGV[0])::integer;
  ELSE
    target_id := (to_jsonb(NEW) ->> TG_ARGV[0])::integer;
  END IF;
  SELECT project_id, initiative_id INTO p, i FROM issue WHERE id = target_id;
  -- The issue is already gone when its rows cascade away; its own delete moved the
  -- markers.
  IF p IS NULL THEN RETURN NULL; END IF;
  IF TG_ARGV[1] = 'board' THEN PERFORM bump_rev('board:' || p, p); END IF;
  PERFORM bump_rev('issue:' || target_id, p);
  IF i IS NOT NULL THEN PERFORM bump_rev('initiative:' || i, p); END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

-- A checklist item reaches its issue through its checklist, so it cannot use
-- rev_issue_child.
CREATE FUNCTION rev_checklist_item() RETURNS trigger AS $$
DECLARE
  checklist_id integer;
  target_id integer;
  p integer;
  i integer;
BEGIN
  IF TG_OP = 'DELETE' THEN checklist_id := OLD.checklist_id; ELSE checklist_id := NEW.checklist_id; END IF;
  SELECT c.issue_id, s.project_id, s.initiative_id INTO target_id, p, i
  FROM issue_checklist c JOIN issue s ON s.id = c.issue_id
  WHERE c.id = checklist_id;
  IF p IS NULL THEN RETURN NULL; END IF;
  PERFORM bump_rev('issue:' || target_id, p);
  IF i IS NOT NULL THEN PERFORM bump_rev('initiative:' || i, p); END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

-- The timeline is shared by issues and initiatives: a row belongs to exactly one of
-- them. Neither owner shows on the board, so this never moves the board marker.
CREATE FUNCTION rev_activity() RETURNS trigger AS $$
DECLARE
  r issue_activity%ROWTYPE;
  p integer;
  i integer;
BEGIN
  IF TG_OP = 'DELETE' THEN r := OLD; ELSE r := NEW; END IF;
  IF r.issue_id IS NOT NULL THEN
    SELECT project_id, initiative_id INTO p, i FROM issue WHERE id = r.issue_id;
    IF p IS NULL THEN RETURN NULL; END IF;
    PERFORM bump_rev('issue:' || r.issue_id, p);
    IF i IS NOT NULL THEN PERFORM bump_rev('initiative:' || i, p); END IF;
  ELSE
    SELECT project_id INTO p FROM initiative WHERE id = r.initiative_id;
    IF p IS NULL THEN RETURN NULL; END IF;
    PERFORM bump_rev('initiative:' || r.initiative_id, p);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE FUNCTION rev_initiative() RETURNS trigger AS $$
DECLARE
  r initiative%ROWTYPE;
BEGIN
  IF TG_OP = 'DELETE' THEN r := OLD; ELSE r := NEW; END IF;
  -- Each issue on the board carries the name of its initiative, so a rename has to
  -- move the board marker too.
  PERFORM bump_rev('board:' || r.project_id, r.project_id);
  IF TG_OP = 'DELETE' THEN
    DELETE FROM revision WHERE scope = 'initiative:' || r.id;
  ELSE
    PERFORM bump_rev('initiative:' || r.id, r.project_id);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE FUNCTION rev_initiative_child() RETURNS trigger AS $$
DECLARE
  target_id integer;
  p integer;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_id := (to_jsonb(OLD) ->> TG_ARGV[0])::integer;
  ELSE
    target_id := (to_jsonb(NEW) ->> TG_ARGV[0])::integer;
  END IF;
  SELECT project_id INTO p FROM initiative WHERE id = target_id;
  IF p IS NULL THEN RETURN NULL; END IF;
  PERFORM bump_rev('board:' || p, p);
  PERFORM bump_rev('initiative:' || target_id, p);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE FUNCTION rev_cycle() RETURNS trigger AS $$
DECLARE
  r cycle%ROWTYPE;
BEGIN
  IF TG_OP = 'DELETE' THEN r := OLD; ELSE r := NEW; END IF;
  PERFORM bump_rev('board:' || r.project_id, r.project_id);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE FUNCTION rev_inbox() RETURNS trigger AS $$
DECLARE
  r notification%ROWTYPE;
BEGIN
  IF TG_OP = 'DELETE' THEN r := OLD; ELSE r := NEW; END IF;
  PERFORM bump_rev('inbox:' || r.project_id || ':' || r.user_id, r.project_id);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

-- Deleting a project cascades into its issues, and each of those deletes inserts a
-- board row for a project that is on its way out. The cleanup runs as a deferred
-- constraint trigger so it fires at commit, once every cascade has left its rows.
CREATE FUNCTION rev_project_cleanup() RETURNS trigger AS $$
BEGIN
  DELETE FROM revision WHERE project_id = OLD.id;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

CREATE TRIGGER issue_rev AFTER INSERT OR UPDATE OR DELETE ON issue
  FOR EACH ROW EXECUTE FUNCTION rev_issue();--> statement-breakpoint
CREATE TRIGGER issue_label_rev AFTER INSERT OR UPDATE OR DELETE ON issue_label
  FOR EACH ROW EXECUTE FUNCTION rev_issue_child('issue_id', 'board');--> statement-breakpoint
CREATE TRIGGER issue_link_rev AFTER INSERT OR UPDATE OR DELETE ON issue_link
  FOR EACH ROW EXECUTE FUNCTION rev_issue_child('source_issue_id', 'board');--> statement-breakpoint
CREATE TRIGGER issue_field_value_rev AFTER INSERT OR UPDATE OR DELETE ON issue_field_value
  FOR EACH ROW EXECUTE FUNCTION rev_issue_child('issue_id', 'board');--> statement-breakpoint
CREATE TRIGGER issue_field_option_rev AFTER INSERT OR UPDATE OR DELETE ON issue_field_option
  FOR EACH ROW EXECUTE FUNCTION rev_issue_child('issue_id', 'board');--> statement-breakpoint
CREATE TRIGGER issue_attachment_rev AFTER INSERT OR UPDATE OR DELETE ON issue_attachment
  FOR EACH ROW EXECUTE FUNCTION rev_issue_child('issue_id', 'detail');--> statement-breakpoint
CREATE TRIGGER issue_checklist_rev AFTER INSERT OR UPDATE OR DELETE ON issue_checklist
  FOR EACH ROW EXECUTE FUNCTION rev_issue_child('issue_id', 'detail');--> statement-breakpoint
CREATE TRIGGER issue_watcher_rev AFTER INSERT OR UPDATE OR DELETE ON issue_watcher
  FOR EACH ROW EXECUTE FUNCTION rev_issue_child('issue_id', 'detail');--> statement-breakpoint
CREATE TRIGGER issue_checklist_item_rev AFTER INSERT OR UPDATE OR DELETE ON issue_checklist_item
  FOR EACH ROW EXECUTE FUNCTION rev_checklist_item();--> statement-breakpoint
CREATE TRIGGER issue_activity_rev AFTER INSERT OR UPDATE OR DELETE ON issue_activity
  FOR EACH ROW EXECUTE FUNCTION rev_activity();--> statement-breakpoint
CREATE TRIGGER initiative_rev AFTER INSERT OR UPDATE OR DELETE ON initiative
  FOR EACH ROW EXECUTE FUNCTION rev_initiative();--> statement-breakpoint
CREATE TRIGGER initiative_label_rev AFTER INSERT OR UPDATE OR DELETE ON initiative_label
  FOR EACH ROW EXECUTE FUNCTION rev_initiative_child('initiative_id');--> statement-breakpoint
CREATE TRIGGER cycle_rev AFTER INSERT OR UPDATE OR DELETE ON cycle
  FOR EACH ROW EXECUTE FUNCTION rev_cycle();--> statement-breakpoint
CREATE TRIGGER notification_rev AFTER INSERT OR UPDATE OR DELETE ON notification
  FOR EACH ROW EXECUTE FUNCTION rev_inbox();--> statement-breakpoint
CREATE CONSTRAINT TRIGGER project_rev_cleanup AFTER DELETE ON project
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION rev_project_cleanup();
