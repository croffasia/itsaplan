ALTER TABLE "issue" ADD COLUMN "parent_id" integer;--> statement-breakpoint
ALTER TABLE "issue" ADD CONSTRAINT "issue_parent_id_issue_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."issue"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "issue_parent_idx" ON "issue" USING btree ("parent_id") WHERE "issue"."parent_id" IS NOT NULL;