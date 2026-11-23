CREATE TABLE "slack_link_request" (
	"code" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"project_id" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "slack_link_request_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "user_slack_account" (
	"user_id" text NOT NULL,
	"slack_team_id" text NOT NULL,
	"slack_user_id" text NOT NULL,
	"name" text,
	"slack_team_name" text,
	"linked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_slack_account_user_id_slack_team_id_pk" PRIMARY KEY("user_id","slack_team_id"),
	CONSTRAINT "user_slack_account_slack_user_unique" UNIQUE("slack_team_id","slack_user_id")
);
--> statement-breakpoint
CREATE TABLE "workspace_slack_setting" (
	"workspace_id" integer PRIMARY KEY NOT NULL,
	"ciphertext" text NOT NULL,
	"iv" text NOT NULL,
	"auth_tag" text NOT NULL,
	"redacted" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "slack_link_request" ADD CONSTRAINT "slack_link_request_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slack_link_request" ADD CONSTRAINT "slack_link_request_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_slack_account" ADD CONSTRAINT "user_slack_account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_slack_setting" ADD CONSTRAINT "workspace_slack_setting_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;