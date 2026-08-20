-- Comment bodies written before a mention was a handle, and the prompt snapshots the
-- agent runs took from them. Each @[Name](user:<id>) token becomes @username: the
-- member's own username, or the project-scoped username of the agent whose bot user
-- it is. A token naming a user that no longer exists is left as it stands — there is
-- no handle to write in its place. Each row is read and written once, so the activity
-- revision trigger fires once per rewritten comment.
DO $$
DECLARE
  source record;
  target record;
  mentioned record;
  rewritten text;
BEGIN
  FOR source IN
    SELECT * FROM (VALUES ('issue_activity', 'body'), ('agent_run', 'prompt')) AS s(tbl, col)
  LOOP
    FOR target IN EXECUTE format(
      'SELECT "id", %I AS content FROM %I WHERE %I LIKE ''%%(user:%%''',
      source.col, source.tbl, source.col
    )
    LOOP
      rewritten := target.content;
      FOR mentioned IN
        SELECT DISTINCT u."id", COALESCE(u."username", a."username") AS handle
        FROM regexp_matches(target.content, '@\[[^\]]*\]\(user:([^)]+)\)', 'g') AS m(token)
        JOIN "user" u ON u."id" = m.token[1]
        LEFT JOIN "ai_agent" a ON a."user_id" = u."id"
        WHERE COALESCE(u."username", a."username") IS NOT NULL
      LOOP
        rewritten := regexp_replace(
          rewritten,
          '@\[[^\]]*\]\(user:' || mentioned."id" || '\)',
          '@' || mentioned.handle,
          'g'
        );
      END LOOP;
      IF rewritten IS DISTINCT FROM target.content THEN
        EXECUTE format('UPDATE %I SET %I = $1 WHERE "id" = $2', source.tbl, source.col)
          USING rewritten, target."id";
      END IF;
    END LOOP;
  END LOOP;
END $$;
