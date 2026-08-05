-- Custom SQL migration file, put your code below! --
-- Seed the new `cycles` permission resource on existing roles. Cycles are planned
-- alongside work items, so mirror each role's `work_items` flags onto `cycles`.
-- A role that can create/edit issues can create/edit cycles; a read-only role gets
-- read-only cycles. Roles missing `work_items` get all flags false.
UPDATE "project_role"
SET "permissions" = "permissions"
  || jsonb_build_object(
    'cycles',
    COALESCE(
      "permissions" -> 'work_items',
      '{"create": false, "edit": false, "read": false, "delete": false}'::jsonb
    )
  )
WHERE NOT ("permissions" ? 'cycles');
