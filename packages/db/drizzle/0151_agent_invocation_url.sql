ALTER TABLE "ai_agent" ADD COLUMN "invocation_url" text;--> statement-breakpoint
ALTER TABLE "ai_agent" ADD COLUMN "invocation_secret_ciphertext" text;--> statement-breakpoint
ALTER TABLE "ai_agent" ADD COLUMN "invocation_secret_iv" text;--> statement-breakpoint
ALTER TABLE "ai_agent" ADD COLUMN "invocation_secret_auth_tag" text;