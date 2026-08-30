CREATE TABLE "scim_group" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_name" text NOT NULL,
	"external_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scim_group_display_name_unique" UNIQUE("display_name")
);
--> statement-breakpoint
CREATE TABLE "scim_group_mapping" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_id" uuid NOT NULL,
	"project_id" integer NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"role_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scim_group_mapping_group_id_project_id_unique" UNIQUE("group_id","project_id"),
	CONSTRAINT "scim_group_mapping_role_check" CHECK ("scim_group_mapping"."role" IN ('owner', 'member'))
);
--> statement-breakpoint
CREATE TABLE "scim_group_member" (
	"group_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "scim_group_member_group_id_user_id_pk" PRIMARY KEY("group_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "active" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "scim_external_id" text;--> statement-breakpoint
ALTER TABLE "project_member" ADD COLUMN "source" text DEFAULT 'invite' NOT NULL;--> statement-breakpoint
ALTER TABLE "scim_group_mapping" ADD CONSTRAINT "scim_group_mapping_group_id_scim_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."scim_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scim_group_mapping" ADD CONSTRAINT "scim_group_mapping_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scim_group_mapping" ADD CONSTRAINT "scim_group_mapping_role_id_project_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."project_role"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scim_group_member" ADD CONSTRAINT "scim_group_member_group_id_scim_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."scim_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scim_group_member" ADD CONSTRAINT "scim_group_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "scim_group_mapping_project_idx" ON "scim_group_mapping" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "scim_group_member_user_idx" ON "scim_group_member" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "project_member" ADD CONSTRAINT "project_member_source_check" CHECK ("project_member"."source" IN ('invite', 'scim'));