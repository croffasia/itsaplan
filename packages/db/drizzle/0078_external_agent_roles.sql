-- An external agent always acts under an explicit role of its project, so what it may
-- do is visible on the Roles page instead of falling back to the built-in default
-- member permissions. Existing agents without one move to their project's default
-- role ("Member"), on both the config row and the bot user's membership.
UPDATE "ai_agent" a
SET "role_id" = r."id"
FROM "project_role" r
WHERE a."kind" = 'external'
  AND a."role_id" IS NULL
  AND r."project_id" = a."project_id"
  AND r."is_default" = true;--> statement-breakpoint

UPDATE "project_member" m
SET "role_id" = a."role_id"
FROM "ai_agent" a
WHERE a."kind" = 'external'
  AND a."role_id" IS NOT NULL
  AND m."user_id" = a."user_id"
  AND m."project_id" = a."project_id"
  AND m."role_id" IS DISTINCT FROM a."role_id";
