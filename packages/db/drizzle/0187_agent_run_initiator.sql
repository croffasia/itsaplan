-- A run started by a comment is for the person who wrote it. A comment an agent wrote
-- starts no run, so an agent author is left out.
UPDATE "agent_run" r
SET "requested_by_user_id" = a."actor_user_id"
FROM "issue_activity" a
WHERE r."source_activity_id" = a."id"
  AND r."requested_by_user_id" IS NULL
  AND a."actor_user_id" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "ai_agent" g WHERE g."user_id" = a."actor_user_id");--> statement-breakpoint
UPDATE "agent_run" r
SET "requested_by_user_id" = c."author_id"
FROM "document_comment" c
WHERE r."source_document_comment_id" = c."id"
  AND r."requested_by_user_id" IS NULL
  AND c."author_id" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "ai_agent" g WHERE g."user_id" = c."author_id");
--> statement-breakpoint
-- An API task an agent sent was stored for the agent. Whose work it was is not known, so
-- it is the project's.
UPDATE "agent_run" SET "requested_by_user_id" = NULL
WHERE "requested_by_user_id" IN (SELECT "user_id" FROM "ai_agent");
