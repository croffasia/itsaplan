-- Accounts that existed before the user table had a username. Each one gets the same
-- name the sign-up hook in @repo/auth would have derived: the local part of the
-- address, with everything the username validator rejects removed, plus three random
-- digits when that name is taken or too short to stand on its own. Agent bot users
-- are skipped — they never sign in, and their address is a generated uuid.
DO $$
DECLARE
  account record;
  stem text;
  candidate text;
BEGIN
  FOR account IN
    SELECT "id", "email" FROM "user"
    WHERE "username" IS NULL AND "email" NOT LIKE '%@agents.local'
    ORDER BY "created_at"
  LOOP
    stem := regexp_replace(lower(split_part(account."email", '@', 1)), '[^a-z0-9_.]', '', 'g');
    stem := left(stem, 27);
    IF stem = '' THEN stem := 'user'; END IF;
    candidate := stem;
    WHILE length(candidate) < 3 OR EXISTS (SELECT 1 FROM "user" WHERE "username" = candidate) LOOP
      candidate := stem || (100 + floor(random() * 900))::int::text;
    END LOOP;
    UPDATE "user" SET "username" = candidate, "display_username" = candidate
    WHERE "id" = account."id";
  END LOOP;
END $$;
