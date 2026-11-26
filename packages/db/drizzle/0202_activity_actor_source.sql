ALTER TABLE "issue_activity" ADD COLUMN "actor_source" text;--> statement-breakpoint
ALTER TABLE "issue_activity" ADD CONSTRAINT "issue_activity_actor_source_check" CHECK ("issue_activity"."actor_source" IN ('github', 'gitlab', 'gitea', 'forgejo', 'bitbucket'));--> statement-breakpoint
-- Entries written as "login (GitHub)" keep the login as the name and the host as the source.
UPDATE "issue_activity"
SET "actor_source" = lower(substring("actor_name" from ' \((GitHub|GitLab|Gitea|Forgejo|Bitbucket)\)$')),
    "actor_name" = substring("actor_name" from '^(.*) \((?:GitHub|GitLab|Gitea|Forgejo|Bitbucket)\)$')
WHERE "actor_user_id" IS NULL
  AND "actor_name" ~ ' \((GitHub|GitLab|Gitea|Forgejo|Bitbucket)\)$';--> statement-breakpoint
UPDATE "issue_activity"
SET "actor_source" = lower("actor_name")
WHERE "actor_user_id" IS NULL
  AND "actor_name" IN ('GitHub', 'GitLab', 'Gitea', 'Forgejo', 'Bitbucket');
