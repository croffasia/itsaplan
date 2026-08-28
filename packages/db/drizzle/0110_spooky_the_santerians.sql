CREATE TABLE "agent_chat_favorite" (
	"user_id" text NOT NULL,
	"agent_id" integer NOT NULL,
	"thread_id" text NOT NULL,
	CONSTRAINT "agent_chat_favorite_user_id_thread_id_pk" PRIMARY KEY("user_id","thread_id")
);
--> statement-breakpoint
ALTER TABLE "agent_chat_favorite" ADD CONSTRAINT "agent_chat_favorite_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_chat_favorite" ADD CONSTRAINT "agent_chat_favorite_agent_id_ai_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."ai_agent"("id") ON DELETE cascade ON UPDATE no action;