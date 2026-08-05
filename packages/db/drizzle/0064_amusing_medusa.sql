CREATE TABLE "project_file" (
	"id" serial PRIMARY KEY NOT NULL,
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"project_id" integer NOT NULL,
	"uploaded_by_user_id" text,
	"s3_key" text NOT NULL,
	"filename" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_file_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
ALTER TABLE "project_file" ADD CONSTRAINT "project_file_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_file" ADD CONSTRAINT "project_file_uploaded_by_user_id_user_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_file_project_idx" ON "project_file" USING btree ("project_id","created_at");--> statement-breakpoint
UPDATE "project_role"
SET "permissions" = jsonb_set(
	"permissions",
	'{files}',
	COALESCE(
		"permissions"->'note_boards',
		'{"create":false,"edit":false,"read":false,"delete":false}'::jsonb
	),
	true
)
WHERE NOT "permissions" ? 'files';
