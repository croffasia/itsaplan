CREATE TABLE "finance_transaction" (
	"id" serial PRIMARY KEY NOT NULL,
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"project_id" integer NOT NULL,
	"created_by_user_id" text,
	"type" text NOT NULL,
	"amount_cents" bigint NOT NULL,
	"category" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"transaction_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "finance_transaction_public_id_unique" UNIQUE("public_id"),
	CONSTRAINT "finance_transaction_type_check" CHECK ("finance_transaction"."type" in ('income', 'expense')),
	CONSTRAINT "finance_transaction_amount_check" CHECK ("finance_transaction"."amount_cents" > 0)
);
--> statement-breakpoint
ALTER TABLE "finance_transaction" ADD CONSTRAINT "finance_transaction_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_transaction" ADD CONSTRAINT "finance_transaction_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "finance_transaction_project_date_idx" ON "finance_transaction" USING btree ("project_id","transaction_date","id");--> statement-breakpoint
UPDATE "project_role"
SET "permissions" = jsonb_set(
	"permissions",
	'{finance}',
	'{"create":false,"edit":false,"read":false,"delete":false}'::jsonb,
	true
)
WHERE NOT "permissions" ? 'finance';
