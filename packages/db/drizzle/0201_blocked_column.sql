ALTER TABLE "project_column" ADD COLUMN "blocked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "issue" ADD COLUMN "blocked_reason" text;--> statement-breakpoint
ALTER TABLE "issue" ADD COLUMN "blocked_from_column_id" integer;--> statement-breakpoint
ALTER TABLE "issue" ADD CONSTRAINT "issue_blocked_from_column_id_project_column_id_fk" FOREIGN KEY ("blocked_from_column_id") REFERENCES "public"."project_column"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "project_column_blocked_uq" ON "project_column" USING btree ("project_id") WHERE "project_column"."blocked";