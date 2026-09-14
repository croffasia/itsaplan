CREATE TABLE "mcp_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor" text NOT NULL,
	"request_id" uuid NOT NULL,
	"tool_name" text NOT NULL,
	"project_id" integer,
	"resource_id" text,
	"result_status" text NOT NULL,
	"duration_ms" integer NOT NULL,
	"record_count" integer DEFAULT 0 NOT NULL,
	"error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mcp_audit_log_status_check" CHECK ("mcp_audit_log"."result_status" IN ('success', 'error', 'denied'))
);
--> statement-breakpoint
ALTER TABLE "mcp_audit_log" ADD CONSTRAINT "mcp_audit_log_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mcp_audit_log_project_created_idx" ON "mcp_audit_log" USING btree ("project_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "mcp_audit_log_actor_created_idx" ON "mcp_audit_log" USING btree ("actor","created_at" DESC NULLS LAST);