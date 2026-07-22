ALTER TABLE "ai_agent" ADD COLUMN "api_key_ciphertext" text;--> statement-breakpoint
ALTER TABLE "ai_agent" ADD COLUMN "api_key_iv" text;--> statement-breakpoint
ALTER TABLE "ai_agent" ADD COLUMN "api_key_auth_tag" text;