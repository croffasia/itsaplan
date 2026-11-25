ALTER TABLE "project_document" ADD COLUMN "pin_position" double precision;--> statement-breakpoint
-- The pages pinned before this column keep the order the Docs home showed them in: by tree
-- position, then by id, across the whole project.
UPDATE "project_document" d
SET "pin_position" = p."place" * 1024
FROM (
  SELECT "id", row_number() OVER (PARTITION BY "project_id" ORDER BY "position", "id") AS "place"
  FROM "project_document"
  WHERE "is_pinned"
) p
WHERE d."id" = p."id";--> statement-breakpoint
ALTER TABLE "project_document" ADD CONSTRAINT "project_document_pin_position_check" CHECK ("project_document"."is_pinned" = ("project_document"."pin_position" is not null));