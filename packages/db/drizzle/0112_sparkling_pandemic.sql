CREATE TABLE "git_managed_repository" (
	"id" serial PRIMARY KEY NOT NULL,
	"connection_id" integer NOT NULL,
	"external_id" text NOT NULL,
	"full_name" text NOT NULL,
	"web_url" text NOT NULL,
	"webhook_external_id" text NOT NULL,
	"status" text DEFAULT 'connected' NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "git_managed_repository_connection_external_unique" UNIQUE("connection_id","external_id")
);
--> statement-breakpoint
CREATE TABLE "git_provider_connection" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"provider" text NOT NULL,
	"base_url" text NOT NULL,
	"account_login" text NOT NULL,
	"ciphertext" text NOT NULL,
	"iv" text NOT NULL,
	"auth_tag" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "git_provider_connection_project_provider_url_account_unique" UNIQUE("project_id","provider","base_url","account_login")
);
--> statement-breakpoint
ALTER TABLE "git_managed_repository" ADD CONSTRAINT "git_managed_repository_connection_id_git_provider_connection_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."git_provider_connection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "git_provider_connection" ADD CONSTRAINT "git_provider_connection_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "git_managed_repository_connection_idx" ON "git_managed_repository" USING btree ("connection_id","full_name");--> statement-breakpoint
CREATE INDEX "git_provider_connection_project_idx" ON "git_provider_connection" USING btree ("project_id");