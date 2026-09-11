CREATE TABLE "import_job" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"created_by_user_id" text NOT NULL,
	"source" text NOT NULL,
	"phase" text DEFAULT 'discover' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"cursor" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"credential_ciphertext" text,
	"credential_iv" text,
	"credential_auth_tag" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "import_job_source_check" CHECK ("import_job"."source" IN ('plane')),
	CONSTRAINT "import_job_phase_check" CHECK ("import_job"."phase" IN ('discover', 'create', 'link', 'attachments', 'done')),
	CONSTRAINT "import_job_status_check" CHECK ("import_job"."status" IN ('pending', 'running', 'paused', 'completed', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "import_record" (
	"id" serial PRIMARY KEY NOT NULL,
	"import_job_id" integer NOT NULL,
	"source_entity_type" text NOT NULL,
	"source_id" text NOT NULL,
	"local_entity_type" text,
	"local_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "import_record_source_entity_type_check" CHECK ("import_record"."source_entity_type" IN ('issue', 'comment', 'label', 'state', 'cycle', 'attachment')),
	CONSTRAINT "import_record_local_entity_type_check" CHECK ("import_record"."local_entity_type" IS NULL OR "import_record"."local_entity_type" IN ('issue', 'comment', 'label', 'state', 'cycle', 'attachment'))
);
--> statement-breakpoint
ALTER TABLE "import_job" ADD CONSTRAINT "import_job_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_job" ADD CONSTRAINT "import_job_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_record" ADD CONSTRAINT "import_record_import_job_id_import_job_id_fk" FOREIGN KEY ("import_job_id") REFERENCES "public"."import_job"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "import_job_project_idx" ON "import_job" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "import_job_due_idx" ON "import_job" USING btree ("next_attempt_at") WHERE "import_job"."status" = 'pending';--> statement-breakpoint
CREATE UNIQUE INDEX "import_record_job_source_uq" ON "import_record" USING btree ("import_job_id","source_entity_type","source_id");--> statement-breakpoint
CREATE INDEX "import_record_job_local_idx" ON "import_record" USING btree ("import_job_id","local_entity_type","local_id");