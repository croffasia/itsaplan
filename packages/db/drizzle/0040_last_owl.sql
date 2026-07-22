CREATE TABLE "user_preference" (
	"user_id" text PRIMARY KEY NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"theme" text DEFAULT 'system' NOT NULL,
	"issue_open_mode" text DEFAULT 'panel' NOT NULL,
	"start_page" text DEFAULT 'work-items' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_preference_theme_check" CHECK ("user_preference"."theme" IN ('light', 'dark', 'system')),
	CONSTRAINT "user_preference_issue_open_mode_check" CHECK ("user_preference"."issue_open_mode" IN ('panel', 'page')),
	CONSTRAINT "user_preference_start_page_check" CHECK ("user_preference"."start_page" IN ('inbox', 'dashboard', 'work-items', 'initiatives', 'ai-chat'))
);
--> statement-breakpoint
ALTER TABLE "user_preference" ADD CONSTRAINT "user_preference_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;