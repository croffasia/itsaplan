-- Custom SQL migration file, put your code below! --
-- Seed the new `initiatives` permission resource on existing roles. Initiatives are
-- managed alongside work items, so mirror each role's `work_items` flags onto
-- `initiatives`. A role that can create/edit issues can create/edit initiatives; a
-- read-only role gets read-only initiatives. Roles missing `work_items` get all
-- flags false.
UPDATE "project_role"
SET "permissions" = "permissions"
  || jsonb_build_object(
    'initiatives',
    COALESCE(
      "permissions" -> 'work_items',
      '{"create": false, "edit": false, "read": false, "delete": false}'::jsonb
    )
  )
WHERE NOT ("permissions" ? 'initiatives');
