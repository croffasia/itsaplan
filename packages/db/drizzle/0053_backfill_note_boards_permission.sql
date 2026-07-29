-- Custom SQL migration file, put your code below! --
-- Seed the new `note_boards` permission resource on existing roles. Note boards
-- were open to every project member before the resource existed, so every role
-- gets all four flags — each role keeps the access it had.
UPDATE "project_role"
SET "permissions" = "permissions"
  || '{"note_boards": {"create": true, "edit": true, "read": true, "delete": true}}'::jsonb
WHERE NOT ("permissions" ? 'note_boards');
--> statement-breakpoint
-- Existing boards have no recorded creator. A personal board was made personal by
-- its owner, so that owner is its creator; a public board keeps a NULL creator and
-- so cannot be switched to private.
UPDATE "note_board"
SET "created_by_user_id" = "owner_user_id"
WHERE "owner_user_id" IS NOT NULL AND "created_by_user_id" IS NULL;
