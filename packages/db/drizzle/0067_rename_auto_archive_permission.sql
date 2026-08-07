-- Custom SQL migration file, put your code below! --
-- The `auto_archive` permission resource became `workflow_config`: the settings
-- section it gates now holds the subtask automations alongside the auto-archive
-- thresholds. Carry each role's flags over under the new key.
UPDATE "project_role"
SET "permissions" = ("permissions" - 'auto_archive')
  || jsonb_build_object('workflow_config', "permissions" -> 'auto_archive')
WHERE "permissions" ? 'auto_archive';
