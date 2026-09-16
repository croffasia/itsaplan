CREATE TABLE "document_collaboration" (
	"document_id" integer PRIMARY KEY NOT NULL,
	"epoch" uuid DEFAULT gen_random_uuid() NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"content_json" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_comment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" integer NOT NULL,
	"parent_id" uuid,
	"author_id" text,
	"body" text NOT NULL,
	"quote" text DEFAULT '' NOT NULL,
	"selection_from" integer,
	"selection_to" integer,
	"orphaned" boolean DEFAULT false NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_step" (
	"document_id" integer NOT NULL,
	"version" integer NOT NULL,
	"client_id" text NOT NULL,
	"step" jsonb NOT NULL,
	CONSTRAINT "document_step_document_id_version_pk" PRIMARY KEY("document_id","version")
);
--> statement-breakpoint
ALTER TABLE "document_collaboration" ADD CONSTRAINT "document_collaboration_document_id_project_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."project_document"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_comment" ADD CONSTRAINT "document_comment_document_id_project_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."project_document"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_comment" ADD CONSTRAINT "document_comment_parent_id_document_comment_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."document_comment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_comment" ADD CONSTRAINT "document_comment_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_step" ADD CONSTRAINT "document_step_document_id_project_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."project_document"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "document_comment_document_idx" ON "document_comment" USING btree ("document_id","created_at");
--> statement-breakpoint
CREATE TRIGGER document_comment_rev AFTER INSERT OR UPDATE OR DELETE ON document_comment
FOR EACH ROW EXECUTE FUNCTION rev_document_child();
