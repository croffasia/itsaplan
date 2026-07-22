ALTER TABLE "ai_agent" ADD COLUMN "memory_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_agent" ADD COLUMN "memory_last_messages" integer;