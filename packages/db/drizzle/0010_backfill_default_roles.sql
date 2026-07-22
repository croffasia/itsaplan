-- Seed the default "Member" role for every existing project and assign it to
-- every current non-owner member. Owners keep role_id NULL (they bypass
-- permission checks). Keep the permission matrix in sync with
-- defaultMemberPermissions() in apps/api/src/shared/permissions.ts.
INSERT INTO "project_role" ("project_id", "name", "is_default", "permissions")
SELECT
	p."id",
	'Member',
	true,
	'{"work_items":{"create":true,"edit":true,"read":true,"delete":true},"dashboards":{"create":false,"edit":false,"read":true,"delete":false},"views":{"create":false,"edit":false,"read":true,"delete":false},"members_invite":{"create":false,"edit":false,"read":false,"delete":false},"members_manage":{"create":false,"edit":false,"read":false,"delete":false},"states":{"create":false,"edit":false,"read":true,"delete":false},"issue_types":{"create":false,"edit":false,"read":true,"delete":false},"labels":{"create":false,"edit":false,"read":true,"delete":false},"assignees":{"create":false,"edit":false,"read":true,"delete":false},"custom_fields":{"create":false,"edit":false,"read":true,"delete":false},"actions":{"create":false,"edit":false,"read":false,"delete":false},"danger_zone":{"create":false,"edit":false,"read":false,"delete":false}}'::jsonb
FROM "project" p
WHERE NOT EXISTS (
	SELECT 1 FROM "project_role" r
	WHERE r."project_id" = p."id" AND r."is_default" = true
);
--> statement-breakpoint
UPDATE "project_member" m
SET "role_id" = r."id"
FROM "project_role" r
WHERE r."project_id" = m."project_id"
	AND r."is_default" = true
	AND m."role" = 'member'
	AND m."role_id" IS NULL;
