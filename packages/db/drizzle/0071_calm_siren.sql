CREATE TABLE "hermes_chat_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"status" text DEFAULT 'streaming' NOT NULL,
	"error_code" text,
	"input_tokens" integer,
	"output_tokens" integer,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hermes_chat_run_conversation_id_idempotency_key_unique" UNIQUE("conversation_id","idempotency_key"),
	CONSTRAINT "hermes_chat_run_request_id_unique" UNIQUE("request_id"),
	CONSTRAINT "hermes_chat_run_status_check" CHECK ("hermes_chat_run"."status" IN ('streaming', 'completed', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "hermes_conversation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" integer NOT NULL,
	"created_by" text NOT NULL,
	"agent_id" integer NOT NULL,
	"hermes_agent_slug" text NOT NULL,
	"hermes_session_id" text NOT NULL,
	"title" text,
	"status" text DEFAULT 'active' NOT NULL,
	"last_message_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hermes_conversation_agent_id_hermes_session_id_unique" UNIQUE("agent_id","hermes_session_id"),
	CONSTRAINT "hermes_conversation_status_check" CHECK ("hermes_conversation"."status" IN ('active', 'archived'))
);
--> statement-breakpoint
CREATE TABLE "hermes_message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sequence" serial NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"hermes_event_id" text,
	"status" text DEFAULT 'completed' NOT NULL,
	"error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hermes_message_role_check" CHECK ("hermes_message"."role" IN ('user', 'assistant')),
	CONSTRAINT "hermes_message_status_check" CHECK ("hermes_message"."status" IN ('pending', 'completed', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "hermes_chat_run" ADD CONSTRAINT "hermes_chat_run_conversation_id_hermes_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."hermes_conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hermes_conversation" ADD CONSTRAINT "hermes_conversation_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hermes_conversation" ADD CONSTRAINT "hermes_conversation_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hermes_conversation" ADD CONSTRAINT "hermes_conversation_agent_id_ai_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."ai_agent"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hermes_message" ADD CONSTRAINT "hermes_message_conversation_id_hermes_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."hermes_conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hermes_chat_run_conversation_idx" ON "hermes_chat_run" USING btree ("conversation_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "hermes_conversation_project_user_idx" ON "hermes_conversation" USING btree ("project_id","created_by","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "hermes_conversation_agent_idx" ON "hermes_conversation" USING btree ("agent_id","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "hermes_message_conversation_idx" ON "hermes_message" USING btree ("conversation_id","sequence");