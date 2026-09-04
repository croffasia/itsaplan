-- Custom SQL migration file, put your code below! --
-- Seed the new `issue_templates` permission resource on existing roles. A template
-- shapes new issues the way a custom field does, so mirror each role's
-- `custom_fields` flags onto it: a role that manages the fields manages the
-- templates, and one that only reads them keeps reading. Roles missing
-- `custom_fields` get all flags false.
UPDATE "project_role"
SET "permissions" = "permissions"
  || jsonb_build_object(
    'issue_templates',
    COALESCE(
      "permissions" -> 'custom_fields',
      '{"create": false, "edit": false, "read": false, "delete": false}'::jsonb
    )
  )
WHERE NOT ("permissions" ? 'issue_templates');
