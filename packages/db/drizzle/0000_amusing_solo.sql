CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assignee" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"name" text NOT NULL,
	"is_human" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assignee_project_id_name_unique" UNIQUE("project_id","name")
);
--> statement-breakpoint
CREATE TABLE "custom_field" (
	"id" serial PRIMARY KEY NOT NULL,
	"issue_type_id" integer,
	"name" text NOT NULL,
	"field_type" text NOT NULL,
	"is_required" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "custom_field_field_type_check" CHECK ("custom_field"."field_type" IN ('text', 'markdown', 'number', 'boolean', 'date', 'select', 'multi_select'))
);
--> statement-breakpoint
CREATE TABLE "custom_field_option" (
	"id" serial PRIMARY KEY NOT NULL,
	"field_id" integer NOT NULL,
	"value" text NOT NULL,
	"color" text DEFAULT '#6b7280' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "custom_field_option_field_id_value_unique" UNIQUE("field_id","value")
);
--> statement-breakpoint
CREATE TABLE "issue" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"sequence_number" integer NOT NULL,
	"type_id" integer,
	"column_id" integer NOT NULL,
	"assignee_id" integer,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"priority" text,
	"start_date" date,
	"due_date" date,
	"position" double precision DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "issue_project_id_sequence_number_unique" UNIQUE("project_id","sequence_number")
);
--> statement-breakpoint
CREATE TABLE "issue_activity" (
	"id" serial PRIMARY KEY NOT NULL,
	"issue_id" integer NOT NULL,
	"kind" text NOT NULL,
	"actor_id" integer,
	"actor_name" text,
	"body" text,
	"action" text,
	"subject" text,
	"from_text" text,
	"to_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "issue_activity_kind_check" CHECK ("issue_activity"."kind" IN ('comment', 'activity'))
);
--> statement-breakpoint
CREATE TABLE "issue_attachment" (
	"id" serial PRIMARY KEY NOT NULL,
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"issue_id" integer NOT NULL,
	"s3_key" text NOT NULL,
	"filename" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "issue_attachment_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
CREATE TABLE "issue_field_option" (
	"issue_id" integer NOT NULL,
	"field_id" integer NOT NULL,
	"option_id" integer NOT NULL,
	CONSTRAINT "issue_field_option_issue_id_field_id_option_id_pk" PRIMARY KEY("issue_id","field_id","option_id")
);
--> statement-breakpoint
CREATE TABLE "issue_field_value" (
	"id" serial PRIMARY KEY NOT NULL,
	"issue_id" integer NOT NULL,
	"field_id" integer NOT NULL,
	"value_text" text,
	"value_number" numeric,
	"value_bool" boolean,
	"value_date" date,
	CONSTRAINT "issue_field_value_issue_id_field_id_unique" UNIQUE("issue_id","field_id")
);
--> statement-breakpoint
CREATE TABLE "issue_label" (
	"issue_id" integer NOT NULL,
	"label_id" integer NOT NULL,
	CONSTRAINT "issue_label_issue_id_label_id_pk" PRIMARY KEY("issue_id","label_id")
);
--> statement-breakpoint
CREATE TABLE "issue_type" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"name" text NOT NULL,
	"icon" text DEFAULT '' NOT NULL,
	"color" text DEFAULT '#6b7280' NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "issue_type_project_id_name_unique" UNIQUE("project_id","name")
);
--> statement-breakpoint
CREATE TABLE "label" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"group_id" integer,
	"name" text NOT NULL,
	"color" text DEFAULT '#6b7280' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "label_project_id_name_unique" UNIQUE("project_id","name")
);
--> statement-breakpoint
CREATE TABLE "label_group" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#6b7280' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "label_group_project_id_name_unique" UNIQUE("project_id","name")
);
--> statement-breakpoint
CREATE TABLE "project" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"next_sequence" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "project_action" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"name" text NOT NULL,
	"condition" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"effect" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"position" double precision DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_column" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"name" text NOT NULL,
	"state_type" text DEFAULT 'unstarted' NOT NULL,
	"color" text DEFAULT '#6b7280' NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_column_project_id_position_unique" UNIQUE("project_id","position"),
	CONSTRAINT "project_column_state_type_check" CHECK ("project_column"."state_type" IN ('backlog', 'unstarted', 'started', 'completed', 'canceled'))
);
--> statement-breakpoint
CREATE TABLE "project_view" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"name" text NOT NULL,
	"icon" text,
	"filters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"display" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"position" double precision DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignee" ADD CONSTRAINT "assignee_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_field" ADD CONSTRAINT "custom_field_issue_type_id_issue_type_id_fk" FOREIGN KEY ("issue_type_id") REFERENCES "public"."issue_type"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_field_option" ADD CONSTRAINT "custom_field_option_field_id_custom_field_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."custom_field"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue" ADD CONSTRAINT "issue_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue" ADD CONSTRAINT "issue_type_id_issue_type_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."issue_type"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue" ADD CONSTRAINT "issue_column_id_project_column_id_fk" FOREIGN KEY ("column_id") REFERENCES "public"."project_column"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue" ADD CONSTRAINT "issue_assignee_id_assignee_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."assignee"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_activity" ADD CONSTRAINT "issue_activity_issue_id_issue_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issue"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_activity" ADD CONSTRAINT "issue_activity_actor_id_assignee_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."assignee"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_attachment" ADD CONSTRAINT "issue_attachment_issue_id_issue_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issue"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_field_option" ADD CONSTRAINT "issue_field_option_issue_id_issue_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issue"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_field_option" ADD CONSTRAINT "issue_field_option_field_id_custom_field_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."custom_field"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_field_option" ADD CONSTRAINT "issue_field_option_option_id_custom_field_option_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."custom_field_option"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_field_value" ADD CONSTRAINT "issue_field_value_issue_id_issue_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issue"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_field_value" ADD CONSTRAINT "issue_field_value_field_id_custom_field_id_fk" FOREIGN KEY ("field_id") REFERENCES "public"."custom_field"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_label" ADD CONSTRAINT "issue_label_issue_id_issue_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issue"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_label" ADD CONSTRAINT "issue_label_label_id_label_id_fk" FOREIGN KEY ("label_id") REFERENCES "public"."label"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_type" ADD CONSTRAINT "issue_type_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "label" ADD CONSTRAINT "label_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "label" ADD CONSTRAINT "label_group_id_label_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."label_group"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "label_group" ADD CONSTRAINT "label_group_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_action" ADD CONSTRAINT "project_action_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_column" ADD CONSTRAINT "project_column_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_view" ADD CONSTRAINT "project_view_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "issue_activity_issue_idx" ON "issue_activity" USING btree ("issue_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "issue_attachment_issue_idx" ON "issue_attachment" USING btree ("issue_id");--> statement-breakpoint
CREATE INDEX "project_action_project_idx" ON "project_action" USING btree ("project_id","position");--> statement-breakpoint
CREATE INDEX "project_view_project_idx" ON "project_view" USING btree ("project_id","position");