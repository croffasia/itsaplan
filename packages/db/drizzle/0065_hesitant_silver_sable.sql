CREATE TABLE "crm_customer" (
	"id" serial PRIMARY KEY NOT NULL,
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"project_id" integer NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'prospect' NOT NULL,
	"service" text DEFAULT '' NOT NULL,
	"owner" text DEFAULT '' NOT NULL,
	"contact_name" text DEFAULT '' NOT NULL,
	"contact_email" text DEFAULT '' NOT NULL,
	"contact_phone" text DEFAULT '' NOT NULL,
	"project_status" text DEFAULT '' NOT NULL,
	"open_tasks" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"last_communication" text DEFAULT '' NOT NULL,
	"next_action" text DEFAULT '' NOT NULL,
	"deadline" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "crm_customer_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "crm_customer_status_check" CHECK ("crm_customer"."status" in ('prospect', 'active', 'inactive'))
);
--> statement-breakpoint
ALTER TABLE "project_file" ADD COLUMN "crm_customer_id" integer;--> statement-breakpoint
ALTER TABLE "crm_customer" ADD CONSTRAINT "crm_customer_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "crm_customer_project_idx" ON "crm_customer" USING btree ("project_id","updated_at");--> statement-breakpoint
ALTER TABLE "project_file" ADD CONSTRAINT "project_file_crm_customer_id_crm_customer_id_fk" FOREIGN KEY ("crm_customer_id") REFERENCES "public"."crm_customer"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_file_crm_customer_idx" ON "project_file" USING btree ("crm_customer_id","created_at");--> statement-breakpoint
UPDATE "project_role"
SET "permissions" = jsonb_set(
	"permissions",
	'{crm}',
	COALESCE(
		"permissions"->'files',
		'{"create":false,"edit":false,"read":false,"delete":false}'::jsonb
	),
	true
)
WHERE NOT "permissions" ? 'crm';
