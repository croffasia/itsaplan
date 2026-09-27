-- Git settings and an issue's development links were gated on `integrations`, so a
-- role that could edit integrations can edit repositories.
UPDATE "team_role"
SET "permissions" = "permissions" || jsonb_build_object(
  'repositories',
  jsonb_build_object(
    'edit', COALESCE(("permissions" #>> '{integrations,edit}')::boolean, false)
  )
)
WHERE NOT ("permissions" ? 'repositories');
