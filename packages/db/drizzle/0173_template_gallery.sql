CREATE TABLE "template_publisher" (
	"workspace_id" integer PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"key_ciphertext" text NOT NULL,
	"key_iv" text NOT NULL,
	"key_auth_tag" text NOT NULL,
	"author_name" text DEFAULT '' NOT NULL,
	"author_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "project_template" ADD COLUMN "publication_id" text;--> statement-breakpoint
ALTER TABLE "project_template" ADD COLUMN "publication_url" text;--> statement-breakpoint
ALTER TABLE "project_template" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "template_publisher" ADD CONSTRAINT "template_publisher_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;