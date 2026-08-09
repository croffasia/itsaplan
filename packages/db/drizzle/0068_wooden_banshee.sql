ALTER TABLE "finance_transaction" ADD COLUMN "counterparty" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "finance_transaction" ADD COLUMN "reference" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "finance_transaction" ADD COLUMN "vat_rate" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "finance_transaction" ADD COLUMN "vat_amount_cents" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "finance_transaction" ADD COLUMN "payment_status" text DEFAULT 'paid' NOT NULL;--> statement-breakpoint
ALTER TABLE "finance_transaction" ADD COLUMN "due_date" date;--> statement-breakpoint
ALTER TABLE "finance_transaction" ADD CONSTRAINT "finance_transaction_vat_rate_check" CHECK ("finance_transaction"."vat_rate" in (0, 9, 21));--> statement-breakpoint
ALTER TABLE "finance_transaction" ADD CONSTRAINT "finance_transaction_vat_amount_check" CHECK ("finance_transaction"."vat_amount_cents" >= 0 and "finance_transaction"."vat_amount_cents" <= "finance_transaction"."amount_cents");--> statement-breakpoint
ALTER TABLE "finance_transaction" ADD CONSTRAINT "finance_transaction_payment_status_check" CHECK ("finance_transaction"."payment_status" in ('open', 'paid'));