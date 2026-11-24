-- The default role moves from each team to the system "Member" role. Nobody's
-- permissions change: a team's default role whose matrix is the system role's is merged
-- into it, and one the team changed stays with the team as a custom role.
DO $$
DECLARE
  system_member integer;
  standard integer[];
BEGIN
  SELECT "id" INTO system_member FROM "team_role" WHERE "team_id" IS NULL AND "is_default";
  IF system_member IS NULL THEN
    RAISE EXCEPTION 'The default system role is missing';
  END IF;

  -- A cell counts as granted only when it holds JSON true, as normalizePermissions reads it.
  SELECT COALESCE(array_agg(r."id"), '{}') INTO standard
    FROM "team_role" r, "team_role" s
   WHERE r."team_id" IS NOT NULL AND r."is_default" AND s."id" = system_member
     AND NOT EXISTS (
       SELECT 1
         FROM jsonb_each(s."permissions") AS res(key, actions),
              jsonb_each(res.actions) AS act(key, allowed)
        WHERE (COALESCE(r."permissions" -> res.key -> act.key, 'false'::jsonb) = 'true'::jsonb)
              <> (act.allowed = 'true'::jsonb)
     );

  UPDATE "project_member" SET "role_id" = system_member WHERE "role_id" = ANY(standard);
  UPDATE "team_invite" SET "role_id" = system_member WHERE "role_id" = ANY(standard);
  UPDATE "scim_group_mapping" SET "role_id" = system_member WHERE "role_id" = ANY(standard);
  DELETE FROM "team_role" WHERE "id" = ANY(standard);

  -- A pending invite with no chosen role would have joined on the team's changed role.
  UPDATE "team_invite" i SET "role_id" = r."id"
    FROM "team_role" r
   WHERE r."team_id" = i."team_id" AND r."is_default"
     AND i."role_id" IS NULL AND i."project_role" = 'member' AND i."status" = 'pending';

  -- A member with no role resolved to the default matrix, which the system role is seeded with.
  UPDATE "project_member" SET "role_id" = system_member
   WHERE "role" = 'member' AND "role_id" IS NULL;

  UPDATE "team_role" SET "is_default" = false WHERE "team_id" IS NOT NULL AND "is_default";
END $$;--> statement-breakpoint
DROP INDEX "team_role_default_uq";--> statement-breakpoint
ALTER TABLE "team_role" ADD CONSTRAINT "team_role_default_system_check" CHECK ("team_role"."team_id" IS NULL OR NOT "team_role"."is_default");
