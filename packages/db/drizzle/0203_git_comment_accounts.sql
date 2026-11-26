CREATE TABLE "git_comment_link" (
	"id" serial PRIMARY KEY NOT NULL,
	"repository_id" integer NOT NULL,
	"activity_id" integer NOT NULL,
	"external_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "git_comment_link_activity_id_unique" UNIQUE("activity_id"),
	CONSTRAINT "git_comment_link_repository_id_external_id_unique" UNIQUE("repository_id","external_id")
);
--> statement-breakpoint
CREATE TABLE "user_git_account" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"base_url" text NOT NULL,
	"account_login" text NOT NULL,
	"ciphertext" text NOT NULL,
	"iv" text NOT NULL,
	"auth_tag" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_git_account_user_id_base_url_unique" UNIQUE("user_id","base_url")
);
--> statement-breakpoint
ALTER TABLE "git_managed_repository" ADD COLUMN "issue_comments_push" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user_preference" ADD COLUMN "unsent_comment_notice_hidden" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "git_comment_link" ADD CONSTRAINT "git_comment_link_repository_id_git_managed_repository_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."git_managed_repository"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "git_comment_link" ADD CONSTRAINT "git_comment_link_activity_id_issue_activity_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."issue_activity"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_git_account" ADD CONSTRAINT "user_git_account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_git_account_login_idx" ON "user_git_account" USING btree ("base_url","account_login");