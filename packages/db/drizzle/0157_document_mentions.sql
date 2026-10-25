ALTER TABLE "notification" ALTER COLUMN "issue_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_run" ADD COLUMN "document_id" integer;--> statement-breakpoint
ALTER TABLE "agent_run" ADD COLUMN "source_document_comment_id" uuid;--> statement-breakpoint
ALTER TABLE "notification" ADD COLUMN "document_id" integer;--> statement-breakpoint
ALTER TABLE "notification" ADD COLUMN "document_comment_id" uuid;--> statement-breakpoint
ALTER TABLE "agent_run" ADD CONSTRAINT "agent_run_document_id_project_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."project_document"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_run" ADD CONSTRAINT "agent_run_source_document_comment_id_document_comment_id_fk" FOREIGN KEY ("source_document_comment_id") REFERENCES "public"."document_comment"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_document_id_project_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."project_document"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_document_comment_id_document_comment_id_fk" FOREIGN KEY ("document_comment_id") REFERENCES "public"."document_comment"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_target_check" CHECK (("notification"."issue_id" IS NULL) <> ("notification"."document_id" IS NULL));