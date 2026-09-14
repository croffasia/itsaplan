CREATE TABLE "braindump_entry" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"author_user_id" text,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"audio_s3_key" text,
	"audio_duration_sec" integer,
	"routed_to" text,
	"routed_at" timestamp with time zone,
	"routed_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "braindump_entry_kind_check" CHECK ("braindump_entry"."kind" IN ('idea', 'task', 'note', 'voice')),
	CONSTRAINT "braindump_entry_routed_to_check" CHECK ("braindump_entry"."routed_to" IS NULL OR "braindump_entry"."routed_to" IN ('obsidian', 'issue', 'schedule'))
);
--> statement-breakpoint
ALTER TABLE "braindump_entry" ADD CONSTRAINT "braindump_entry_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "braindump_entry" ADD CONSTRAINT "braindump_entry_author_user_id_user_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "braindump_entry_project_created_idx" ON "braindump_entry" USING btree ("project_id","created_at" DESC NULLS LAST);