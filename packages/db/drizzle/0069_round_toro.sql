CREATE TABLE "revision" (
	"scope" text PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"rev" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX "revision_project_idx" ON "revision" USING btree ("project_id");