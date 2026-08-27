CREATE TABLE "chat_attachment" (
	"id" serial PRIMARY KEY NOT NULL,
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"project_id" integer NOT NULL,
	"uploaded_by_user_id" text,
	"s3_key" text NOT NULL,
	"filename" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_attachment_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "issue_import" (
	"id" serial PRIMARY KEY NOT NULL,
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"project_id" integer NOT NULL,
	"attachment_id" integer NOT NULL,
	"status" text DEFAULT 'mapped' NOT NULL,
	"mapping" jsonb,
	"error_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "issue_import_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
ALTER TABLE "chat_attachment" ADD CONSTRAINT "chat_attachment_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_attachment" ADD CONSTRAINT "chat_attachment_uploaded_by_user_id_user_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_import" ADD CONSTRAINT "issue_import_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_import" ADD CONSTRAINT "issue_import_attachment_id_chat_attachment_id_fk" FOREIGN KEY ("attachment_id") REFERENCES "public"."chat_attachment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_attachment_project_idx" ON "chat_attachment" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "issue_import_project_idx" ON "issue_import" USING btree ("project_id");