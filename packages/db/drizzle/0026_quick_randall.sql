CREATE TABLE "agent_tool_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"tool_key" text NOT NULL,
	"label" text,
	"ciphertext" text NOT NULL,
	"iv" text NOT NULL,
	"auth_tag" text NOT NULL,
	"redacted" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_tool_config_link" (
	"agent_id" integer NOT NULL,
	"tool_config_id" integer NOT NULL,
	CONSTRAINT "agent_tool_config_link_agent_id_tool_config_id_pk" PRIMARY KEY("agent_id","tool_config_id")
);
--> statement-breakpoint
ALTER TABLE "agent_tool_config" ADD CONSTRAINT "agent_tool_config_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_tool_config_link" ADD CONSTRAINT "agent_tool_config_link_agent_id_ai_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."ai_agent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_tool_config_link" ADD CONSTRAINT "agent_tool_config_link_tool_config_id_agent_tool_config_id_fk" FOREIGN KEY ("tool_config_id") REFERENCES "public"."agent_tool_config"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_tool_config_project_idx" ON "agent_tool_config" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "agent_tool_config_link_config_idx" ON "agent_tool_config_link" USING btree ("tool_config_id");