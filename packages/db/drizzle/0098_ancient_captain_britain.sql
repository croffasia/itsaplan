CREATE TABLE "issue_cycle" (
	"id" serial PRIMARY KEY NOT NULL,
	"issue_id" integer NOT NULL,
	"cycle_id" integer NOT NULL,
	"entered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"left_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "issue_cycle" ADD CONSTRAINT "issue_cycle_issue_id_issue_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issue"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_cycle" ADD CONSTRAINT "issue_cycle_cycle_id_cycle_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycle"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "issue_cycle_issue_idx" ON "issue_cycle" USING btree ("issue_id","entered_at");--> statement-breakpoint
CREATE UNIQUE INDEX "issue_cycle_open_idx" ON "issue_cycle" USING btree ("issue_id","cycle_id") WHERE "issue_cycle"."left_at" IS NULL;--> statement-breakpoint
CREATE TRIGGER issue_cycle_rev AFTER INSERT OR UPDATE OR DELETE ON issue_cycle
  FOR EACH ROW EXECUTE FUNCTION rev_issue_child('issue_id', 'detail');--> statement-breakpoint

-- Every issue that already sits on a cycle gets its open record, so the history
-- starts from the state the release finds. Past moves are not recovered: the change
-- log holds cycle names, not identifiers.
INSERT INTO "issue_cycle" ("issue_id", "cycle_id")
SELECT "id", "cycle_id" FROM "issue" WHERE "cycle_id" IS NOT NULL;
