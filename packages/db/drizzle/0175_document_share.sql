ALTER TABLE "project_document" ADD COLUMN "share_token" uuid;--> statement-breakpoint
ALTER TABLE "project_document" ADD COLUMN "share_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "project_document" ADD COLUMN "share_include_children" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "project_document" ADD COLUMN "share_include_issues" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "project_document" ADD CONSTRAINT "project_document_share_token_unique" UNIQUE("share_token");