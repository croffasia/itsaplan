CREATE TABLE "ai_agent" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"username" text NOT NULL,
	"kind" text NOT NULL,
	"provider" text,
	"model" text,
	"instructions" text,
	"tools" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"temperature" double precision,
	"max_steps" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_agent_project_id_username_unique" UNIQUE("project_id","username"),
	CONSTRAINT "ai_agent_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "ai_agent_kind_check" CHECK ("ai_agent"."kind" IN ('external', 'internal'))
);
--> statement-breakpoint
ALTER TABLE "issue" ADD COLUMN "assignee_user_id" text;--> statement-breakpoint
ALTER TABLE "issue_activity" ADD COLUMN "actor_user_id" text;--> statement-breakpoint
ALTER TABLE "ai_agent" ADD CONSTRAINT "ai_agent_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_agent" ADD CONSTRAINT "ai_agent_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_agent_project_idx" ON "ai_agent" USING btree ("project_id");--> statement-breakpoint
ALTER TABLE "issue" ADD CONSTRAINT "issue_assignee_user_id_user_id_fk" FOREIGN KEY ("assignee_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_activity" ADD CONSTRAINT "issue_activity_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;