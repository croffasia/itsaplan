-- The repository integration now lists every repository that has delivered, not
-- only the last one. Seed the list from the last delivery already recorded, so a
-- project that is connected shows its repository before the next delivery arrives.
UPDATE "project_setting"
SET "value" = "value" || jsonb_build_object(
  'repositories',
  jsonb_build_array(jsonb_build_object(
    'repo', "value"->>'lastEventRepo',
    'provider', COALESCE("value"->>'lastEventProvider', 'GitHub'),
    'lastEventAt', COALESCE("value"->>'lastEventAt', now()::text)
  ))
)
WHERE "key" = 'git'
  AND "value"->>'lastEventRepo' IS NOT NULL
  AND "value"->'repositories' IS NULL;
