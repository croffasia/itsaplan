-- Custom SQL migration file, put your code below! --
-- The `assignees` permission resource was renamed to `ai_agents`. Carry the flags
-- over on existing roles: copy the old sub-object to `ai_agents` and drop
-- `assignees`, so a role that could read assignees can read AI agents.
UPDATE "project_role"
SET "permissions" = ("permissions" - 'assignees')
  || jsonb_build_object('ai_agents', "permissions" -> 'assignees')
WHERE "permissions" ? 'assignees';
