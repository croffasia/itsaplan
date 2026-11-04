-- IF NOT EXISTS: some instances already have these columns from an earlier build of this change.
ALTER TABLE "git_provider_connection" ADD COLUMN IF NOT EXISTS "auth_type" text DEFAULT 'token' NOT NULL;--> statement-breakpoint
ALTER TABLE "git_provider_connection" ADD COLUMN IF NOT EXISTS "app_id" text;--> statement-breakpoint
ALTER TABLE "git_provider_connection" ADD COLUMN IF NOT EXISTS "installation_id" text;
