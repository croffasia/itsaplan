CREATE TABLE "intake_attachment" (
	"id" serial PRIMARY KEY NOT NULL,
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"intake_request_id" integer NOT NULL,
	"s3_key" text NOT NULL,
	"filename" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "intake_attachment_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "intake_comment" (
	"id" serial PRIMARY KEY NOT NULL,
	"intake_request_id" integer NOT NULL,
	"actor_user_id" text,
	"actor_name" text,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intake_request" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"priority" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"source" text DEFAULT 'app' NOT NULL,
	"external_id" text,
	"submitted_by_user_id" text,
	"submitted_by_name" text,
	"reviewed_by_user_id" text,
	"reviewed_by_name" text,
	"reviewed_at" timestamp with time zone,
	"decline_reason" text,
	"snoozed_until" timestamp with time zone,
	"accepted_issue_id" integer,
	"duplicate_of_issue_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "intake_request_status_check" CHECK ("intake_request"."status" IN ('pending', 'snoozed', 'accepted', 'declined', 'duplicate'))
);
--> statement-breakpoint
ALTER TABLE "notification" DROP CONSTRAINT "notification_type_check";--> statement-breakpoint
ALTER TABLE "notification" DROP CONSTRAINT "notification_target_check";--> statement-breakpoint
ALTER TABLE "notification" ADD COLUMN "intake_request_id" integer;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "intake_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "intake_attachment" ADD CONSTRAINT "intake_attachment_intake_request_id_intake_request_id_fk" FOREIGN KEY ("intake_request_id") REFERENCES "public"."intake_request"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_comment" ADD CONSTRAINT "intake_comment_intake_request_id_intake_request_id_fk" FOREIGN KEY ("intake_request_id") REFERENCES "public"."intake_request"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_comment" ADD CONSTRAINT "intake_comment_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_request" ADD CONSTRAINT "intake_request_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_request" ADD CONSTRAINT "intake_request_submitted_by_user_id_user_id_fk" FOREIGN KEY ("submitted_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_request" ADD CONSTRAINT "intake_request_reviewed_by_user_id_user_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_request" ADD CONSTRAINT "intake_request_accepted_issue_id_issue_id_fk" FOREIGN KEY ("accepted_issue_id") REFERENCES "public"."issue"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intake_request" ADD CONSTRAINT "intake_request_duplicate_of_issue_id_issue_id_fk" FOREIGN KEY ("duplicate_of_issue_id") REFERENCES "public"."issue"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "intake_attachment_request_idx" ON "intake_attachment" USING btree ("intake_request_id");--> statement-breakpoint
CREATE INDEX "intake_comment_request_idx" ON "intake_comment" USING btree ("intake_request_id","created_at","id");--> statement-breakpoint
CREATE INDEX "intake_request_project_status_idx" ON "intake_request" USING btree ("project_id","status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "intake_request_project_source_external_uq" ON "intake_request" USING btree ("project_id","source","external_id") WHERE "intake_request"."external_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_intake_request_id_intake_request_id_fk" FOREIGN KEY ("intake_request_id") REFERENCES "public"."intake_request"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notification_intake_request_idx" ON "notification" USING btree ("intake_request_id") WHERE "notification"."intake_request_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_type_check" CHECK ("notification"."type" IN ('assigned', 'mentioned', 'commented', 'state_changed', 'reacted', 'intake_accepted', 'intake_declined', 'intake_snoozed', 'intake_duplicate'));--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_target_check" CHECK (("notification"."intake_request_id" IS NOT NULL AND "notification"."document_id" IS NULL) OR ("notification"."intake_request_id" IS NULL AND (("notification"."issue_id" IS NULL) <> ("notification"."document_id" IS NULL))));--> statement-breakpoint
UPDATE "team_role"
SET "permissions" = "permissions"
  || '{"intake": {"create": true, "edit": true, "read": true, "delete": true}}'::jsonb
WHERE "team_id" IS NULL AND "is_default" = true AND NOT ("permissions" ? 'intake');--> statement-breakpoint
CREATE OR REPLACE FUNCTION rev_intake_request() RETURNS trigger AS $$
DECLARE
  pid integer;
BEGIN
  pid := COALESCE(NEW.project_id, OLD.project_id);
  IF pid IS NOT NULL THEN
    PERFORM bump_rev('intake:' || pid, pid);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE OR REPLACE FUNCTION rev_intake_child() RETURNS trigger AS $$
DECLARE
  rid integer;
  pid integer;
BEGIN
  rid := COALESCE(NEW.intake_request_id, OLD.intake_request_id);
  IF rid IS NOT NULL THEN
    SELECT project_id INTO pid FROM intake_request WHERE id = rid;
    IF pid IS NOT NULL THEN
      PERFORM bump_rev('intake:' || pid, pid);
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER intake_request_rev AFTER INSERT OR UPDATE OR DELETE ON intake_request
  FOR EACH ROW EXECUTE FUNCTION rev_intake_request();--> statement-breakpoint
CREATE TRIGGER intake_comment_rev AFTER INSERT OR UPDATE OR DELETE ON intake_comment
  FOR EACH ROW EXECUTE FUNCTION rev_intake_child();--> statement-breakpoint
CREATE TRIGGER intake_attachment_rev AFTER INSERT OR UPDATE OR DELETE ON intake_attachment
  FOR EACH ROW EXECUTE FUNCTION rev_intake_child();
