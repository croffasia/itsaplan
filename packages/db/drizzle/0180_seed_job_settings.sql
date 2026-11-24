-- Seed the background job settings, so every installation has a row to edit in god mode
-- and the jobs read nothing else. defaultJobSettings() in src/domains/job-settings.ts
-- holds the same values for the tests, which empty the table.
INSERT INTO "app_setting" ("key", "value")
VALUES (
	'jobs',
	'{"webhooks":{"pollIntervalMs":2000,"batchSize":20,"timeoutMs":10000,"maxAttempts":8,"disableThreshold":20,"leaseSeconds":120,"retentionDays":30,"cleanupIntervalMinutes":10},"notifications":{"batchSize":20,"maxAttempts":5,"leaseSeconds":120},"imports":{"pollIntervalMs":3000},"agentRuns":{"pollIntervalMs":2000,"maxAttempts":3,"leaseSeconds":300},"agentChat":{"leaseSeconds":300,"maxAttempts":3,"claimWaitMs":25000,"claimPollMs":500,"streamPollMs":300,"historyMessages":20},"agentInvocations":{"pollIntervalMs":1000,"timeoutMs":15000},"sweeps":{"autoArchiveMinutes":60,"tracePruneMinutes":60,"shareExpiryMinutes":1},"bot":{"configPollIntervalMs":30000}}'::jsonb
)
ON CONFLICT ("key") DO NOTHING;
