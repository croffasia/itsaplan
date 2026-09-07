CREATE TABLE "document_asset" (
	"id" serial PRIMARY KEY NOT NULL,
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"document_id" integer NOT NULL,
	"uploaded_by_user_id" text,
	"s3_key" text NOT NULL,
	"filename" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_asset_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "project_document" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"parent_id" integer,
	"title" text DEFAULT '' NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"content_json" jsonb,
	"icon" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"full_width" boolean DEFAULT false NOT NULL,
	"is_private" boolean DEFAULT false NOT NULL,
	"is_locked" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"archived_by_ancestor_id" integer,
	"position" double precision DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"owner_user_id" text,
	"created_by_user_id" text,
	"updated_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_document_version_check" CHECK ("project_document"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "project_document_issue" (
	"document_id" integer NOT NULL,
	"issue_id" integer NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_document_issue_document_id_issue_id_pk" PRIMARY KEY("document_id","issue_id")
);
--> statement-breakpoint
CREATE TABLE "project_document_preference" (
	"document_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_document_preference_document_id_user_id_pk" PRIMARY KEY("document_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "project_document_revision" (
	"id" serial PRIMARY KEY NOT NULL,
	"document_id" integer NOT NULL,
	"version" integer NOT NULL,
	"parent_id" integer,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"content_json" jsonb,
	"icon" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"full_width" boolean DEFAULT false NOT NULL,
	"is_private" boolean DEFAULT false NOT NULL,
	"is_locked" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"position" double precision NOT NULL,
	"owner_user_id" text,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_document_revision_document_version_unique" UNIQUE("document_id","version")
);
--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "documents_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "document_asset" ADD CONSTRAINT "document_asset_document_id_project_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."project_document"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_asset" ADD CONSTRAINT "document_asset_uploaded_by_user_id_user_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_document" ADD CONSTRAINT "project_document_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_document" ADD CONSTRAINT "project_document_parent_id_project_document_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."project_document"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_document" ADD CONSTRAINT "project_document_archived_by_ancestor_id_project_document_id_fk" FOREIGN KEY ("archived_by_ancestor_id") REFERENCES "public"."project_document"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_document" ADD CONSTRAINT "project_document_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_document" ADD CONSTRAINT "project_document_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_document" ADD CONSTRAINT "project_document_updated_by_user_id_user_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_document_issue" ADD CONSTRAINT "project_document_issue_document_id_project_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."project_document"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_document_issue" ADD CONSTRAINT "project_document_issue_issue_id_issue_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issue"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_document_issue" ADD CONSTRAINT "project_document_issue_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_document_preference" ADD CONSTRAINT "project_document_preference_document_id_project_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."project_document"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_document_preference" ADD CONSTRAINT "project_document_preference_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_document_revision" ADD CONSTRAINT "project_document_revision_document_id_project_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."project_document"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_document_revision" ADD CONSTRAINT "project_document_revision_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_document_revision" ADD CONSTRAINT "project_document_revision_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "document_asset_document_idx" ON "document_asset" USING btree ("document_id","created_at");--> statement-breakpoint
CREATE INDEX "project_document_project_tree_idx" ON "project_document" USING btree ("project_id","parent_id","position","id");--> statement-breakpoint
CREATE INDEX "project_document_owner_idx" ON "project_document" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "project_document_project_archive_idx" ON "project_document" USING btree ("project_id","archived_at");--> statement-breakpoint
CREATE INDEX "project_document_issue_issue_idx" ON "project_document_issue" USING btree ("issue_id","document_id");--> statement-breakpoint
CREATE INDEX "project_document_preference_user_idx" ON "project_document_preference" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "project_document_revision_document_idx" ON "project_document_revision" USING btree ("document_id","version");--> statement-breakpoint

-- New pages receive the creator as their explicit owner unless an internal
-- writer has already selected another owner.
CREATE OR REPLACE FUNCTION default_project_document_owner()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."owner_user_id" IS NULL THEN
    NEW."owner_user_id" := NEW."created_by_user_id";
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint

CREATE TRIGGER "project_document_owner_default"
BEFORE INSERT ON "project_document"
FOR EACH ROW
EXECUTE FUNCTION default_project_document_owner();
--> statement-breakpoint

-- Capture persisted page states atomically. Consecutive content edits by the
-- same actor within ten minutes replace the immediately preceding snapshot so
-- autosave does not make version history noisy. Structural and access changes
-- remain explicit checkpoints, and only the newest twenty snapshots are kept.
CREATE OR REPLACE FUNCTION capture_project_document_revision()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  actor_id text := COALESCE(NEW."updated_by_user_id", NEW."created_by_user_id");
  previous_revision "project_document_revision"%ROWTYPE;
  preceding_revision "project_document_revision"%ROWTYPE;
  coalesce_edit boolean := false;
  previous_is_content_edit boolean := false;
BEGIN
  IF current_setting('app.document_rebalance', true) = 'true' THEN
    RETURN NEW;
  END IF;

  -- Ignore same-version physical maintenance only when the snapshot payload is
  -- unchanged. Project copy deliberately rewrites parent/content at version 1,
  -- and those updates must still replace the seeded revision.
  IF TG_OP = 'UPDATE'
    AND NEW."version" = OLD."version"
    AND ROW(
      NEW."parent_id", NEW."title", NEW."content", NEW."content_json",
      NEW."icon", NEW."metadata", NEW."full_width", NEW."is_private",
      NEW."is_locked", NEW."archived_at", NEW."position", NEW."owner_user_id"
    ) IS NOT DISTINCT FROM ROW(
      OLD."parent_id", OLD."title", OLD."content", OLD."content_json",
      OLD."icon", OLD."metadata", OLD."full_width", OLD."is_private",
      OLD."is_locked", OLD."archived_at", OLD."position", OLD."owner_user_id"
    )
  THEN
    RETURN NEW;
  END IF;

  SELECT * INTO previous_revision
  FROM "project_document_revision"
  WHERE "document_id" = NEW."id"
  ORDER BY "version" DESC
  LIMIT 1;

  SELECT * INTO preceding_revision
  FROM "project_document_revision"
  WHERE "document_id" = NEW."id"
  ORDER BY "version" DESC
  OFFSET 1
  LIMIT 1;

  IF TG_OP = 'UPDATE' THEN
    coalesce_edit :=
      OLD."parent_id" IS NOT DISTINCT FROM NEW."parent_id"
      AND OLD."icon" IS NOT DISTINCT FROM NEW."icon"
      AND OLD."metadata" IS NOT DISTINCT FROM NEW."metadata"
      AND OLD."full_width" IS NOT DISTINCT FROM NEW."full_width"
      AND OLD."is_private" IS NOT DISTINCT FROM NEW."is_private"
      AND OLD."is_locked" IS NOT DISTINCT FROM NEW."is_locked"
      AND OLD."archived_at" IS NOT DISTINCT FROM NEW."archived_at"
      AND OLD."position" IS NOT DISTINCT FROM NEW."position"
      AND OLD."owner_user_id" IS NOT DISTINCT FROM NEW."owner_user_id"
      AND (
        OLD."title" IS DISTINCT FROM NEW."title"
        OR OLD."content" IS DISTINCT FROM NEW."content"
        OR OLD."content_json" IS DISTINCT FROM NEW."content_json"
      );
  END IF;

  IF previous_revision."id" IS NOT NULL AND preceding_revision."id" IS NOT NULL THEN
    previous_is_content_edit :=
      previous_revision."parent_id" IS NOT DISTINCT FROM preceding_revision."parent_id"
      AND previous_revision."icon" IS NOT DISTINCT FROM preceding_revision."icon"
      AND previous_revision."metadata" IS NOT DISTINCT FROM preceding_revision."metadata"
      AND previous_revision."full_width" IS NOT DISTINCT FROM preceding_revision."full_width"
      AND previous_revision."is_private" IS NOT DISTINCT FROM preceding_revision."is_private"
      AND previous_revision."is_locked" IS NOT DISTINCT FROM preceding_revision."is_locked"
      AND previous_revision."archived_at" IS NOT DISTINCT FROM preceding_revision."archived_at"
      AND previous_revision."position" IS NOT DISTINCT FROM preceding_revision."position"
      AND previous_revision."owner_user_id" IS NOT DISTINCT FROM preceding_revision."owner_user_id"
      AND (
        previous_revision."title" IS DISTINCT FROM preceding_revision."title"
        OR previous_revision."content" IS DISTINCT FROM preceding_revision."content"
        OR previous_revision."content_json" IS DISTINCT FROM preceding_revision."content_json"
      );
  END IF;

  IF coalesce_edit
    AND previous_is_content_edit
    AND current_setting('app.document_checkpoint', true) IS DISTINCT FROM 'true'
    AND previous_revision."id" IS NOT NULL
    AND previous_revision."created_by_user_id" IS NOT DISTINCT FROM actor_id
    AND previous_revision."created_at" BETWEEN NEW."updated_at" - interval '10 minutes' AND NEW."updated_at"
  THEN
    UPDATE "project_document_revision" SET
      "version" = NEW."version",
      "parent_id" = NEW."parent_id",
      "title" = NEW."title",
      "content" = NEW."content",
      "content_json" = NEW."content_json",
      "icon" = NEW."icon",
      "metadata" = NEW."metadata",
      "full_width" = NEW."full_width",
      "is_private" = NEW."is_private",
      "is_locked" = NEW."is_locked",
      "archived_at" = NEW."archived_at",
      "position" = NEW."position",
      "owner_user_id" = NEW."owner_user_id",
      "created_by_user_id" = actor_id,
      "created_at" = NEW."updated_at"
    WHERE "id" = previous_revision."id";
  ELSE
    INSERT INTO "project_document_revision" (
      "document_id",
      "version",
      "parent_id",
      "title",
      "content",
      "content_json",
      "icon",
      "metadata",
      "full_width",
      "is_private",
      "is_locked",
      "archived_at",
      "position",
      "owner_user_id",
      "created_by_user_id",
      "created_at"
    ) VALUES (
      NEW."id",
      NEW."version",
      NEW."parent_id",
      NEW."title",
      NEW."content",
      NEW."content_json",
      NEW."icon",
      NEW."metadata",
      NEW."full_width",
      NEW."is_private",
      NEW."is_locked",
      NEW."archived_at",
      NEW."position",
      NEW."owner_user_id",
      actor_id,
      NEW."updated_at"
    )
    ON CONFLICT ("document_id", "version") DO UPDATE SET
      "parent_id" = EXCLUDED."parent_id",
      "title" = EXCLUDED."title",
      "content" = EXCLUDED."content",
      "content_json" = EXCLUDED."content_json",
      "icon" = EXCLUDED."icon",
      "metadata" = EXCLUDED."metadata",
      "full_width" = EXCLUDED."full_width",
      "is_private" = EXCLUDED."is_private",
      "is_locked" = EXCLUDED."is_locked",
      "archived_at" = EXCLUDED."archived_at",
      "position" = EXCLUDED."position",
      "owner_user_id" = EXCLUDED."owner_user_id",
      "created_by_user_id" = EXCLUDED."created_by_user_id",
      "created_at" = EXCLUDED."created_at";
  END IF;

  DELETE FROM "project_document_revision"
  WHERE "id" IN (
    SELECT "id"
    FROM "project_document_revision"
    WHERE "document_id" = NEW."id"
    ORDER BY "version" DESC
    OFFSET 20
  );
  RETURN NEW;
END;
$$;
--> statement-breakpoint

CREATE TRIGGER "project_document_revision_capture"
AFTER INSERT OR UPDATE ON "project_document"
FOR EACH ROW
EXECUTE FUNCTION capture_project_document_revision();
--> statement-breakpoint

CREATE OR REPLACE FUNCTION rev_document()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  row_project_id integer;
BEGIN
  IF current_setting('app.document_rebalance', true) = 'true' THEN
    RETURN NULL;
  END IF;

  IF TG_OP = 'DELETE' THEN
    row_project_id := OLD."project_id";
  ELSE
    row_project_id := NEW."project_id";
  END IF;
  PERFORM bump_rev('documents:' || row_project_id, row_project_id);
  RETURN NULL;
END;
$$;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION rev_document_child()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  document_id integer;
  row_project_id integer;
BEGIN
  IF TG_OP = 'DELETE' THEN
    document_id := OLD."document_id";
  ELSE
    document_id := NEW."document_id";
  END IF;
  SELECT "project_id" INTO row_project_id
  FROM "project_document"
  WHERE "id" = document_id;
  IF row_project_id IS NOT NULL THEN
    PERFORM bump_rev('documents:' || row_project_id, row_project_id);
  END IF;
  RETURN NULL;
END;
$$;
--> statement-breakpoint

CREATE TRIGGER "project_document_rev"
AFTER INSERT OR UPDATE OR DELETE ON "project_document"
FOR EACH ROW
EXECUTE FUNCTION rev_document();
--> statement-breakpoint

CREATE TRIGGER "document_asset_rev"
AFTER INSERT OR UPDATE OR DELETE ON "document_asset"
FOR EACH ROW
EXECUTE FUNCTION rev_document_child();
--> statement-breakpoint

CREATE TRIGGER "project_document_preference_rev"
AFTER INSERT OR UPDATE OR DELETE ON "project_document_preference"
FOR EACH ROW
EXECUTE FUNCTION rev_document_child();

--> statement-breakpoint
CREATE FUNCTION project_document_issue_validate_project() RETURNS trigger AS $$
DECLARE
  document_project_id integer;
  issue_project_id integer;
BEGIN
  SELECT project_id INTO document_project_id FROM project_document WHERE id = NEW.document_id;
  SELECT project_id INTO issue_project_id FROM issue WHERE id = NEW.issue_id;
  IF document_project_id IS NULL OR issue_project_id IS NULL OR document_project_id <> issue_project_id THEN
    RAISE EXCEPTION 'A document and work item link must stay inside one project'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER project_document_issue_validate_project
BEFORE INSERT OR UPDATE ON project_document_issue
FOR EACH ROW EXECUTE FUNCTION project_document_issue_validate_project();
--> statement-breakpoint
CREATE FUNCTION project_document_issue_rev() RETURNS trigger AS $$
DECLARE
  row_document_id integer;
  row_issue_id integer;
  row_project_id integer;
BEGIN
  row_document_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.document_id ELSE NEW.document_id END;
  row_issue_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.issue_id ELSE NEW.issue_id END;
  SELECT project_id INTO row_project_id FROM project_document WHERE id = row_document_id;
  IF row_project_id IS NULL THEN
    SELECT project_id INTO row_project_id FROM issue WHERE id = row_issue_id;
  END IF;
  IF row_project_id IS NOT NULL THEN
    PERFORM bump_rev('documents:' || row_project_id, row_project_id);
    PERFORM bump_rev('issue:' || row_issue_id, row_project_id);
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER project_document_issue_rev
AFTER INSERT OR DELETE ON project_document_issue
FOR EACH ROW EXECUTE FUNCTION project_document_issue_rev();
