CREATE TABLE "issue_watcher" (
	"issue_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"subscribed" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "issue_watcher_issue_id_user_id_pk" PRIMARY KEY("issue_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "user_preference" ADD COLUMN "auto_watch" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "issue_watcher" ADD CONSTRAINT "issue_watcher_issue_id_issue_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issue"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_watcher" ADD CONSTRAINT "issue_watcher_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Backfill: notification recipients used to be derived from the activity feed, so
-- everyone who had acted on an issue received its notifications. Subscribing them
-- keeps those notifications running instead of stopping every issue at zero
-- watchers.
INSERT INTO "issue_watcher" ("issue_id", "user_id")
SELECT DISTINCT a."issue_id", a."actor_user_id"
  FROM "issue_activity" a
  JOIN "issue" i ON i."id" = a."issue_id"
  JOIN "project_member" pm ON pm."project_id" = i."project_id" AND pm."user_id" = a."actor_user_id"
 WHERE a."actor_user_id" IS NOT NULL
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "issue_watcher" ("issue_id", "user_id")
SELECT i."id", i."assignee_user_id"
  FROM "issue" i
  JOIN "project_member" pm ON pm."project_id" = i."project_id" AND pm."user_id" = i."assignee_user_id"
 WHERE i."assignee_user_id" IS NOT NULL
ON CONFLICT DO NOTHING;