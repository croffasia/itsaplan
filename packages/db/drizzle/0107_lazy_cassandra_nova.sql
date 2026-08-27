CREATE TABLE "agent_chat_usage" (
	"thread_id" text PRIMARY KEY NOT NULL,
	"agent_id" integer NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_chat_usage" ADD CONSTRAINT "agent_chat_usage_agent_id_ai_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."ai_agent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_chat_usage_agent_idx" ON "agent_chat_usage" USING btree ("agent_id");