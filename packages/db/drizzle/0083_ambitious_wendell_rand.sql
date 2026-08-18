CREATE TABLE "agent_chat_event" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"message_id" integer NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_chat_message" (
	"id" serial PRIMARY KEY NOT NULL,
	"thread_id" text NOT NULL,
	"agent_id" integer NOT NULL,
	"role" text NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_error" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_chat_message_role_check" CHECK ("agent_chat_message"."role" IN ('user', 'assistant')),
	CONSTRAINT "agent_chat_message_status_check" CHECK ("agent_chat_message"."status" IN ('pending', 'streaming', 'success', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "agent_chat_thread" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"title" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_chat_event" ADD CONSTRAINT "agent_chat_event_message_id_agent_chat_message_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."agent_chat_message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_chat_message" ADD CONSTRAINT "agent_chat_message_thread_id_agent_chat_thread_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."agent_chat_thread"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_chat_message" ADD CONSTRAINT "agent_chat_message_agent_id_ai_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."ai_agent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_chat_thread" ADD CONSTRAINT "agent_chat_thread_agent_id_ai_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."ai_agent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_chat_thread" ADD CONSTRAINT "agent_chat_thread_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_chat_event_message_idx" ON "agent_chat_event" USING btree ("message_id","id");--> statement-breakpoint
CREATE INDEX "agent_chat_message_thread_idx" ON "agent_chat_message" USING btree ("thread_id","id");--> statement-breakpoint
CREATE INDEX "agent_chat_message_due_idx" ON "agent_chat_message" USING btree ("agent_id","next_attempt_at") WHERE "agent_chat_message"."status" IN ('pending', 'streaming');--> statement-breakpoint
CREATE INDEX "agent_chat_thread_agent_user_idx" ON "agent_chat_thread" USING btree ("agent_id","user_id","updated_at" DESC NULLS LAST);