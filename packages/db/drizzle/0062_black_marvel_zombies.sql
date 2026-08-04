CREATE TABLE "issue_checklist" (
	"id" serial PRIMARY KEY NOT NULL,
	"issue_id" integer NOT NULL,
	"title" text NOT NULL,
	"position" double precision DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "issue_checklist_item" (
	"id" serial PRIMARY KEY NOT NULL,
	"checklist_id" integer NOT NULL,
	"content" text NOT NULL,
	"done" boolean DEFAULT false NOT NULL,
	"position" double precision DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "issue_checklist" ADD CONSTRAINT "issue_checklist_issue_id_issue_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issue"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_checklist_item" ADD CONSTRAINT "issue_checklist_item_checklist_id_issue_checklist_id_fk" FOREIGN KEY ("checklist_id") REFERENCES "public"."issue_checklist"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "issue_checklist_issue_idx" ON "issue_checklist" USING btree ("issue_id","position");--> statement-breakpoint
CREATE INDEX "issue_checklist_item_checklist_idx" ON "issue_checklist_item" USING btree ("checklist_id","position");