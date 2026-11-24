-- The default role no longer reads the configuration settings pages. A member works on
-- the board and issues without them: the project itself hands out its states, types,
-- labels, custom fields and issue templates.
UPDATE "team_role"
   SET "permissions" = jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set("permissions",
         '{states,read}', 'false'),
         '{issue_types,read}', 'false'),
         '{labels,read}', 'false'),
         '{custom_fields,read}', 'false'),
         '{issue_templates,read}', 'false')
 WHERE "team_id" IS NULL AND "is_default";
