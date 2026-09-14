CREATE TABLE "competitor" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"added_by_user_id" text,
	"platform" text NOT NULL,
	"handle" text NOT NULL,
	"label" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"last_checked_at" timestamp with time zone,
	"last_error" text,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "competitor_project_account_unique" UNIQUE("project_id","platform","handle"),
	CONSTRAINT "competitor_platform_check" CHECK ("competitor"."platform" IN ('instagram', 'tiktok', 'facebook'))
);
--> statement-breakpoint
CREATE TABLE "competitor_event" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"competitor_id" integer NOT NULL,
	"kind" text NOT NULL,
	"summary" text NOT NULL,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"post_url" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "competitor_event_kind_check" CHECK ("competitor_event"."kind" IN ('new_post', 'followers_jump', 'followers_drop', 'profile_changed', 'went_quiet', 'check_failed'))
);
--> statement-breakpoint
CREATE TABLE "competitor_snapshot" (
	"id" serial PRIMARY KEY NOT NULL,
	"competitor_id" integer NOT NULL,
	"followers" integer,
	"following" integer,
	"posts" integer,
	"display_name" text,
	"biography" text,
	"avatar_url" text,
	"latest_post_id" text,
	"latest_post_url" text,
	"latest_post_at" timestamp with time zone,
	"latest_post_caption" text,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "competitor" ADD CONSTRAINT "competitor_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitor" ADD CONSTRAINT "competitor_added_by_user_id_user_id_fk" FOREIGN KEY ("added_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitor_event" ADD CONSTRAINT "competitor_event_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitor_event" ADD CONSTRAINT "competitor_event_competitor_id_competitor_id_fk" FOREIGN KEY ("competitor_id") REFERENCES "public"."competitor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitor_snapshot" ADD CONSTRAINT "competitor_snapshot_competitor_id_competitor_id_fk" FOREIGN KEY ("competitor_id") REFERENCES "public"."competitor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "competitor_project_idx" ON "competitor" USING btree ("project_id","active");--> statement-breakpoint
CREATE INDEX "competitor_event_project_created_idx" ON "competitor_event" USING btree ("project_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "competitor_snapshot_competitor_idx" ON "competitor_snapshot" USING btree ("competitor_id","captured_at" DESC NULLS LAST);