ALTER TABLE "user_preference" ADD COLUMN "palette" text DEFAULT 'default' NOT NULL;--> statement-breakpoint
ALTER TABLE "user_preference" ADD COLUMN "custom_theme" jsonb;