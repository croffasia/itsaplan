-- models.dev renamed the Kimi For Coding provider (api.kimi.com) to kimi-code-plan-cn, and Mastra's model router resolves the new id only.
UPDATE "integration_credential" SET "integration_key" = 'kimi-code-plan-cn' WHERE "integration_key" = 'kimi-for-coding';--> statement-breakpoint
-- A workspace's own price is copied rather than renamed: the spans of past calls keep the old provider id, and their cost is worked out from these rows each time a dashboard is read.
INSERT INTO "model_price" ("workspace_id", "provider", "model", "input", "output", "cache_read", "cache_write")
SELECT "workspace_id", 'kimi-code-plan-cn', "model", "input", "output", "cache_read", "cache_write"
FROM "model_price" WHERE "provider" = 'kimi-for-coding'
ON CONFLICT ("workspace_id", "provider", "model") DO NOTHING;
