-- Seed the instance upload limits so every installation has a row to edit in god
-- mode, existing ones included. Keep these values in sync with
-- defaultStorageSettings() in apps/api/src/settings/storage.ts, which still applies
-- them in memory if the row is missing.
INSERT INTO "app_setting" ("key", "value")
VALUES (
	'storage',
	'{"maxAttachmentMb":25,"maxAvatarMb":5,"projectQuotaMb":51200,"attachmentMimeTypes":["image/*","video/*","application/pdf","text/plain","text/csv","text/markdown","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document","application/vnd.oasis.opendocument.text","application/vnd.ms-excel","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","application/vnd.oasis.opendocument.spreadsheet","application/vnd.ms-powerpoint","application/vnd.openxmlformats-officedocument.presentationml.presentation","application/vnd.oasis.opendocument.presentation"]}'::jsonb
)
ON CONFLICT ("key") DO NOTHING;
