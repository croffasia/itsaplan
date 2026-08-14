ALTER TABLE "ai_agent" ADD COLUMN "owner_user_id" text;--> statement-breakpoint
ALTER TABLE "ai_agent" ADD COLUMN "runner_scope" text DEFAULT 'owner' NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_agent" ADD COLUMN "last_seen_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ai_agent" ADD CONSTRAINT "ai_agent_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_agent" ADD CONSTRAINT "ai_agent_runner_scope_check" CHECK ("ai_agent"."runner_scope" IN ('owner', 'project'));