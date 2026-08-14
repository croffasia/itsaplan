-- Agents that existed before owner_user_id took the 'owner' scope from the column's
-- first default, with no owner to restrict them to. They move to the project scope,
-- which is what an external agent added to a project is expected to do: work for
-- every member.
UPDATE "ai_agent"
SET "runner_scope" = 'project'
WHERE "runner_scope" = 'owner' AND "owner_user_id" IS NULL;
