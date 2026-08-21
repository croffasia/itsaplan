CREATE TABLE "agent_field_trigger" (
	"agent_id" integer NOT NULL,
	"field_id" integer NOT NULL,
	CONSTRAINT "agent_field_trigger_agent_id_field_id_pk" PRIMARY KEY("agent_id","field_id")
);
--> statement-breakpoint
ALTER TABLE "custom_field" DROP CONSTRAINT "custom_field_field_type_check";--> statement-breakpoint
ALTER TABLE "custom_field" ADD COLUMN "member_scope" text;--> statement-breakpoint
ALTER TABLE "issue_field_value" ADD COLUMN "value_user_id" text;--> statement-breakpoint
ALTER TABLE "agent_field_trigger" ADD CONSTRAINT "agent_field_trigger_agent_id_ai_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."ai_agent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_field_trigger" ADD CONSTRAINT "agent_field_trigger_field_id_custom_field_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."custom_field"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_field_trigger_field_idx" ON "agent_field_trigger" USING btree ("field_id");--> statement-breakpoint
ALTER TABLE "issue_field_value" ADD CONSTRAINT "issue_field_value_value_user_id_user_id_fk" FOREIGN KEY ("value_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_field" ADD CONSTRAINT "custom_field_member_scope_check" CHECK (("custom_field"."field_type" = 'member') = ("custom_field"."member_scope" IS NOT NULL) AND ("custom_field"."member_scope" IS NULL OR "custom_field"."member_scope" IN ('all', 'humans', 'agents')));--> statement-breakpoint
ALTER TABLE "custom_field" ADD CONSTRAINT "custom_field_field_type_check" CHECK ("custom_field"."field_type" IN ('text', 'markdown', 'url', 'number', 'boolean', 'date', 'datetime', 'datetime_range', 'select', 'multi_select', 'member'));