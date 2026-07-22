CREATE TABLE "project_member" (
	"project_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_member_project_id_user_id_pk" PRIMARY KEY("project_id","user_id"),
	CONSTRAINT "project_member_role_check" CHECK ("project_member"."role" IN ('owner', 'member'))
);
--> statement-breakpoint
ALTER TABLE "custom_field" ADD COLUMN "project_id" integer;--> statement-breakpoint
UPDATE "custom_field" SET "project_id" = "issue_type"."project_id" FROM "issue_type" WHERE "custom_field"."issue_type_id" = "issue_type"."id";--> statement-breakpoint
DELETE FROM "custom_field" WHERE "project_id" IS NULL;--> statement-breakpoint
ALTER TABLE "custom_field" ALTER COLUMN "project_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "project_member" ADD CONSTRAINT "project_member_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_member" ADD CONSTRAINT "project_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_member_user_idx" ON "project_member" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "custom_field" ADD CONSTRAINT "custom_field_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;