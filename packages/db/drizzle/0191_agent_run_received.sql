ALTER TABLE "agent_run" ADD COLUMN "received_at" timestamp with time zone;--> statement-breakpoint
-- An external agent took a run that it reported on or sent events for, and every run its
-- runner claimed: an agent with no invocation URL gets a run only by claiming it. The
-- other runs of an agent with an invocation URL may have been refused, so they stay unknown.
UPDATE "agent_run" r
SET "received_at" = coalesce(r."started_at", r."created_at")
FROM "ai_agent" g
WHERE g."id" = r."agent_id"
  AND g."kind" = 'external'
  AND (r."status" = 'success'
    OR r."output" IS NOT NULL
    OR r."input_tokens" IS NOT NULL
    OR (g."invocation_url" IS NULL AND r."attempts" > 0)
    OR EXISTS (SELECT 1 FROM "agent_run_trace" t WHERE t."run_id" = r."id"));
