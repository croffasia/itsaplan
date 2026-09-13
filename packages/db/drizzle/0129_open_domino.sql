ALTER TABLE "import_job" DROP CONSTRAINT "import_job_phase_check";--> statement-breakpoint
ALTER TABLE "import_record" ADD COLUMN "source_display_id" text;--> statement-breakpoint
CREATE INDEX "import_record_job_display_idx" ON "import_record" USING btree ("import_job_id","source_entity_type","source_display_id");--> statement-breakpoint
ALTER TABLE "import_job" ADD CONSTRAINT "import_job_phase_check" CHECK ("import_job"."phase" IN ('discover', 'create', 'link', 'rewrite', 'attachments', 'done'));