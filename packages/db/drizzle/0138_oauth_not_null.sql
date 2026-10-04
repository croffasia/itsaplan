-- A client registered without a client_name has no name; registration names it 'MCP client'.
UPDATE "oauth_application" SET "name" = 'MCP client' WHERE "name" IS NULL;--> statement-breakpoint
ALTER TABLE "oauth_access_token" ALTER COLUMN "access_token" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "oauth_access_token" ALTER COLUMN "refresh_token" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "oauth_access_token" ALTER COLUMN "access_token_expires_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "oauth_access_token" ALTER COLUMN "refresh_token_expires_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "oauth_access_token" ALTER COLUMN "client_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "oauth_access_token" ALTER COLUMN "scopes" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "oauth_access_token" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "oauth_access_token" ALTER COLUMN "updated_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "oauth_application" ALTER COLUMN "name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "oauth_application" ALTER COLUMN "client_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "oauth_application" ALTER COLUMN "redirect_urls" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "oauth_application" ALTER COLUMN "type" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "oauth_application" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "oauth_application" ALTER COLUMN "updated_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "oauth_consent" ALTER COLUMN "client_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "oauth_consent" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "oauth_consent" ALTER COLUMN "scopes" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "oauth_consent" ALTER COLUMN "created_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "oauth_consent" ALTER COLUMN "updated_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "oauth_consent" ALTER COLUMN "consent_given" SET NOT NULL;