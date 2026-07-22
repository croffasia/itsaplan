CREATE TABLE "agent_tool" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"tool_key" text NOT NULL,
	"credential_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_tool_project_id_tool_key_credential_id_unique" UNIQUE("project_id","tool_key","credential_id")
);
--> statement-breakpoint
CREATE TABLE "agent_tool_link" (
	"agent_id" integer NOT NULL,
	"agent_tool_id" integer NOT NULL,
	CONSTRAINT "agent_tool_link_agent_id_agent_tool_id_pk" PRIMARY KEY("agent_id","agent_tool_id")
);
--> statement-breakpoint
CREATE TABLE "integration_credential" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"integration_key" text NOT NULL,
	"label" text,
	"ciphertext" text NOT NULL,
	"iv" text NOT NULL,
	"auth_tag" text NOT NULL,
	"redacted" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_agent" ADD COLUMN "model_credential_id" integer;--> statement-breakpoint
ALTER TABLE "agent_tool" ADD CONSTRAINT "agent_tool_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_tool" ADD CONSTRAINT "agent_tool_credential_id_integration_credential_id_fk" FOREIGN KEY ("credential_id") REFERENCES "public"."integration_credential"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_tool_link" ADD CONSTRAINT "agent_tool_link_agent_id_ai_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."ai_agent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_tool_link" ADD CONSTRAINT "agent_tool_link_agent_tool_id_agent_tool_id_fk" FOREIGN KEY ("agent_tool_id") REFERENCES "public"."agent_tool"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_credential" ADD CONSTRAINT "integration_credential_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_tool_project_idx" ON "agent_tool" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "agent_tool_credential_idx" ON "agent_tool" USING btree ("credential_id");--> statement-breakpoint
CREATE INDEX "agent_tool_link_tool_idx" ON "agent_tool_link" USING btree ("agent_tool_id");--> statement-breakpoint
CREATE INDEX "integration_credential_project_idx" ON "integration_credential" USING btree ("project_id");--> statement-breakpoint
ALTER TABLE "ai_agent" ADD CONSTRAINT "ai_agent_model_credential_id_integration_credential_id_fk" FOREIGN KEY ("model_credential_id") REFERENCES "public"."integration_credential"("id") ON DELETE set null ON UPDATE no action;