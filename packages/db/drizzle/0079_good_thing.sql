CREATE TABLE "studio_post" (
	"id" serial PRIMARY KEY NOT NULL,
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"project_id" integer NOT NULL,
	"template_id" integer NOT NULL,
	"created_by_user_id" text,
	"title" text NOT NULL,
	"topic" text DEFAULT '' NOT NULL,
	"headline" text DEFAULT '' NOT NULL,
	"subtext" text DEFAULT '' NOT NULL,
	"caption" text DEFAULT '' NOT NULL,
	"image_prompt" text DEFAULT '' NOT NULL,
	"folder" text NOT NULL,
	"source_image_file_id" integer,
	"rendered_file_id" integer,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "studio_post_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "studio_post_status_check" CHECK ("studio_post"."status" IN ('draft', 'ready'))
);
--> statement-breakpoint
CREATE TABLE "studio_template" (
	"id" serial PRIMARY KEY NOT NULL,
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"project_id" integer NOT NULL,
	"name" text NOT NULL,
	"layout" text DEFAULT 'banner' NOT NULL,
	"aspect" text DEFAULT 'square' NOT NULL,
	"background_color" text DEFAULT '#0f172a' NOT NULL,
	"text_color" text DEFAULT '#ffffff' NOT NULL,
	"accent_color" text DEFAULT '#38bdf8' NOT NULL,
	"font_family" text DEFAULT 'Inter' NOT NULL,
	"style_prompt" text DEFAULT '' NOT NULL,
	"credential_id" integer,
	"image_model" text DEFAULT 'google/gemini-3.1-flash-image' NOT NULL,
	"text_model" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "studio_template_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "studio_template_project_name_unique" UNIQUE("project_id","name"),
	CONSTRAINT "studio_template_layout_check" CHECK ("studio_template"."layout" IN ('banner', 'quote', 'stat')),
	CONSTRAINT "studio_template_aspect_check" CHECK ("studio_template"."aspect" IN ('square', 'portrait', 'story'))
);
--> statement-breakpoint
ALTER TABLE "project_file" ADD COLUMN "folder" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "studio_post" ADD CONSTRAINT "studio_post_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "studio_post" ADD CONSTRAINT "studio_post_template_id_studio_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."studio_template"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "studio_post" ADD CONSTRAINT "studio_post_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "studio_post" ADD CONSTRAINT "studio_post_source_image_file_id_project_file_id_fk" FOREIGN KEY ("source_image_file_id") REFERENCES "public"."project_file"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "studio_post" ADD CONSTRAINT "studio_post_rendered_file_id_project_file_id_fk" FOREIGN KEY ("rendered_file_id") REFERENCES "public"."project_file"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "studio_template" ADD CONSTRAINT "studio_template_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "studio_template" ADD CONSTRAINT "studio_template_credential_id_integration_credential_id_fk" FOREIGN KEY ("credential_id") REFERENCES "public"."integration_credential"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "studio_post_project_idx" ON "studio_post" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "studio_template_project_idx" ON "studio_template" USING btree ("project_id","name");--> statement-breakpoint
CREATE INDEX "project_file_folder_idx" ON "project_file" USING btree ("project_id","folder");