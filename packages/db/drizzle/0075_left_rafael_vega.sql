ALTER TABLE "custom_field" DROP CONSTRAINT "custom_field_field_type_check";--> statement-breakpoint
ALTER TABLE "issue_field_value" ADD COLUMN "value_datetime" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "issue_field_value" ADD COLUMN "value_datetime_end" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "custom_field" ADD CONSTRAINT "custom_field_field_type_check" CHECK ("custom_field"."field_type" IN ('text', 'markdown', 'url', 'number', 'boolean', 'date', 'datetime', 'datetime_range', 'select', 'multi_select'));