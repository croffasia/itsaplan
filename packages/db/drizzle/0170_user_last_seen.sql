ALTER TABLE "user" ADD COLUMN "last_seen_at" timestamp;--> statement-breakpoint
-- The sessions still open are the only record of use there is; signed-out accounts start empty.
UPDATE "user" u SET "last_seen_at" = s."at"
FROM (SELECT "user_id", max("updated_at") AS "at" FROM "session" GROUP BY "user_id") s
WHERE s."user_id" = u."id";
