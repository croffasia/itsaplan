ALTER TABLE "git_provider_connection" ADD COLUMN "team_id" integer;
--> statement-breakpoint
ALTER TABLE "git_managed_repository" ADD COLUMN "project_id" integer;
--> statement-breakpoint

UPDATE "git_provider_connection" AS connection
SET "team_id" = project."team_id"
FROM "project" AS project
WHERE connection."project_id" = project."id";
--> statement-breakpoint

UPDATE "git_managed_repository" AS repository
SET "project_id" = connection."project_id"
FROM "git_provider_connection" AS connection
WHERE repository."connection_id" = connection."id";
--> statement-breakpoint

-- A team may already have connected the same account in several projects.
-- Keep its most recently updated credential, while retaining every project's
-- repository row and its independently installed webhook.
ALTER TABLE "git_managed_repository" DROP CONSTRAINT "git_managed_repository_connection_external_unique";
--> statement-breakpoint
WITH ranked AS (
  SELECT "id", first_value("id") OVER (
    PARTITION BY "team_id", "provider", "base_url", "account_login"
    ORDER BY "updated_at" DESC, "id" DESC
  ) AS canonical_id
  FROM "git_provider_connection"
)
UPDATE "git_managed_repository" AS repository
SET "connection_id" = ranked.canonical_id,
    "last_error" = COALESCE(repository."last_error", 'Team Git token must be verified for this repository. Save the team connection to reconcile its webhook.')
FROM ranked
WHERE repository."connection_id" = ranked."id"
  AND ranked."id" <> ranked.canonical_id;
--> statement-breakpoint

WITH ranked AS (
  SELECT "id", row_number() OVER (
    PARTITION BY "team_id", "provider", "base_url", "account_login"
    ORDER BY "updated_at" DESC, "id" DESC
  ) AS position
  FROM "git_provider_connection"
)
DELETE FROM "git_provider_connection" AS connection
USING ranked
WHERE connection."id" = ranked."id" AND ranked.position > 1;
--> statement-breakpoint

ALTER TABLE "git_provider_connection" ALTER COLUMN "team_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "git_managed_repository" ALTER COLUMN "project_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "git_provider_connection" ADD CONSTRAINT "git_provider_connection_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "git_managed_repository" ADD CONSTRAINT "git_managed_repository_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "git_provider_connection" DROP CONSTRAINT "git_provider_connection_project_id_project_id_fk";
--> statement-breakpoint
ALTER TABLE "git_provider_connection" DROP CONSTRAINT "git_provider_connection_project_provider_url_account_unique";
--> statement-breakpoint
DROP INDEX "git_provider_connection_project_idx";
--> statement-breakpoint
DROP INDEX "git_managed_repository_connection_idx";
--> statement-breakpoint
ALTER TABLE "git_provider_connection" DROP COLUMN "project_id";
--> statement-breakpoint
ALTER TABLE "git_provider_connection" ADD CONSTRAINT "git_provider_connection_team_provider_url_account_unique" UNIQUE("team_id", "provider", "base_url", "account_login");
--> statement-breakpoint
ALTER TABLE "git_managed_repository" ADD CONSTRAINT "git_managed_repository_project_connection_external_unique" UNIQUE("project_id", "connection_id", "external_id");
--> statement-breakpoint
CREATE INDEX "git_provider_connection_team_idx" ON "git_provider_connection" USING btree ("team_id");
--> statement-breakpoint
CREATE INDEX "git_managed_repository_project_connection_idx" ON "git_managed_repository" USING btree ("project_id", "connection_id");
--> statement-breakpoint
