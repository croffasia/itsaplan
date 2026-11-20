CREATE TABLE "agent_forge_identity" (
	"agent_id" integer NOT NULL,
	"connection_id" integer NOT NULL,
	"login" text NOT NULL,
	CONSTRAINT "agent_forge_identity_connection_id_login_pk" PRIMARY KEY("connection_id","login")
);
--> statement-breakpoint
ALTER TABLE "agent_run" DROP CONSTRAINT "agent_run_trigger_check";--> statement-breakpoint
ALTER TABLE "ai_agent" ADD COLUMN "trigger_on_review" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_forge_identity" ADD CONSTRAINT "agent_forge_identity_agent_id_ai_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."ai_agent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_forge_identity" ADD CONSTRAINT "agent_forge_identity_connection_id_git_provider_connection_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."git_provider_connection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_forge_identity_agent_idx" ON "agent_forge_identity" USING btree ("agent_id");--> statement-breakpoint
ALTER TABLE "agent_run" ADD CONSTRAINT "agent_run_trigger_check" CHECK ("agent_run"."trigger" IN ('mention', 'delegation', 'field', 'review', 'schedule', 'manual', 'status', 'event', 'api'));