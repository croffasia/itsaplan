CREATE TABLE "issue_link" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_issue_id" integer NOT NULL,
	"target_issue_id" integer NOT NULL,
	"kind" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "issue_link_source_issue_id_target_issue_id_kind_unique" UNIQUE("source_issue_id","target_issue_id","kind"),
	CONSTRAINT "issue_link_kind_check" CHECK ("issue_link"."kind" IN ('blocks', 'relates', 'duplicates')),
	CONSTRAINT "issue_link_self_check" CHECK ("issue_link"."source_issue_id" <> "issue_link"."target_issue_id")
);
--> statement-breakpoint
ALTER TABLE "issue_link" ADD CONSTRAINT "issue_link_source_issue_id_issue_id_fk" FOREIGN KEY ("source_issue_id") REFERENCES "public"."issue"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_link" ADD CONSTRAINT "issue_link_target_issue_id_issue_id_fk" FOREIGN KEY ("target_issue_id") REFERENCES "public"."issue"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "issue_link_target_idx" ON "issue_link" USING btree ("target_issue_id");