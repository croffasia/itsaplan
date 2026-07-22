CREATE TABLE "agent_skill" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"source" text NOT NULL,
	"source_url" text,
	"s3_prefix" text NOT NULL,
	"files" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "agent_skill_project_id_name_unique" UNIQUE("project_id","name"),
	CONSTRAINT "agent_skill_source_check" CHECK ("agent_skill"."source" IN ('upload', 'inline', 'github'))
);
--> statement-breakpoint
CREATE TABLE "agent_skill_link" (
	"agent_id" integer NOT NULL,
	"skill_id" integer NOT NULL,
	CONSTRAINT "agent_skill_link_agent_id_skill_id_pk" PRIMARY KEY("agent_id","skill_id")
);
--> statement-breakpoint
CREATE TABLE "ai_provider_credential" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"provider" text NOT NULL,
	"label" text,
	"ciphertext" text NOT NULL,
	"iv" text NOT NULL,
	"auth_tag" text NOT NULL,
	"key_last4" text NOT NULL,
	"base_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_provider_credential_project_id_provider_unique" UNIQUE("project_id","provider")
);
--> statement-breakpoint
ALTER TABLE "ai_agent" ADD COLUMN "trigger_on_mention" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_agent" ADD COLUMN "trigger_on_assign" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_agent" ADD COLUMN "role_id" integer;--> statement-breakpoint
ALTER TABLE "agent_skill" ADD CONSTRAINT "agent_skill_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_skill_link" ADD CONSTRAINT "agent_skill_link_agent_id_ai_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."ai_agent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_skill_link" ADD CONSTRAINT "agent_skill_link_skill_id_agent_skill_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."agent_skill"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_provider_credential" ADD CONSTRAINT "ai_provider_credential_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_skill_project_idx" ON "agent_skill" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "agent_skill_link_skill_idx" ON "agent_skill_link" USING btree ("skill_id");--> statement-breakpoint
CREATE INDEX "ai_provider_credential_project_idx" ON "ai_provider_credential" USING btree ("project_id");--> statement-breakpoint
ALTER TABLE "ai_agent" ADD CONSTRAINT "ai_agent_role_id_project_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."project_role"("id") ON DELETE set null ON UPDATE no action;