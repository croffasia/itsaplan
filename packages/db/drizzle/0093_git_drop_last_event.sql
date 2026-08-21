-- The repository list carries the time of each repository's last delivery, so the
-- single last-delivery record it replaced has no reader left.
UPDATE "project_setting"
SET "value" = "value" - 'lastEventAt' - 'lastEventRepo' - 'lastEventProvider'
WHERE "key" = 'git';
