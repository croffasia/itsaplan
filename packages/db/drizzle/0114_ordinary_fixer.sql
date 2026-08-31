ALTER TABLE "issue_development_link" DROP CONSTRAINT "issue_development_link_issue_id_provider_repository_number_unique";--> statement-breakpoint
ALTER TABLE "issue_development_link" ALTER COLUMN "number" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "issue_development_link" ADD COLUMN "kind" text DEFAULT 'pull_request' NOT NULL;--> statement-breakpoint
ALTER TABLE "issue_development_link" ADD COLUMN "external_key" text;--> statement-breakpoint
UPDATE "issue_development_link" SET "external_key" = 'pull_request:' || "number"::text;--> statement-breakpoint
ALTER TABLE "issue_development_link" ALTER COLUMN "external_key" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "issue_development_link" ADD CONSTRAINT "issue_development_link_issue_id_provider_repository_external_key_unique" UNIQUE("issue_id","provider","repository","external_key");
