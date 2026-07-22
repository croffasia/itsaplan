CREATE TABLE "project_setting" (
	"project_id" integer NOT NULL,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_setting_project_id_key_pk" PRIMARY KEY("project_id","key")
);
--> statement-breakpoint
ALTER TABLE "issue" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "project_setting" ADD CONSTRAINT "project_setting_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "issue_project_active_idx" ON "issue" USING btree ("project_id","column_id") WHERE "issue"."archived_at" IS NULL;