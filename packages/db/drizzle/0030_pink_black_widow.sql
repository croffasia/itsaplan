CREATE TABLE "initiative" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'planned' NOT NULL,
	"owner_user_id" text,
	"priority" text,
	"start_date" date,
	"target_date" date,
	"position" double precision DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "initiative_status_check" CHECK ("initiative"."status" IN ('proposed', 'planned', 'active', 'completed', 'canceled'))
);
--> statement-breakpoint
CREATE TABLE "initiative_label" (
	"initiative_id" integer NOT NULL,
	"label_id" integer NOT NULL,
	CONSTRAINT "initiative_label_initiative_id_label_id_pk" PRIMARY KEY("initiative_id","label_id")
);
--> statement-breakpoint
ALTER TABLE "issue_activity" ALTER COLUMN "issue_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "issue" ADD COLUMN "initiative_id" integer;--> statement-breakpoint
ALTER TABLE "issue_activity" ADD COLUMN "initiative_id" integer;--> statement-breakpoint
ALTER TABLE "initiative" ADD CONSTRAINT "initiative_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "initiative" ADD CONSTRAINT "initiative_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "initiative_label" ADD CONSTRAINT "initiative_label_initiative_id_initiative_id_fk" FOREIGN KEY ("initiative_id") REFERENCES "public"."initiative"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "initiative_label" ADD CONSTRAINT "initiative_label_label_id_label_id_fk" FOREIGN KEY ("label_id") REFERENCES "public"."label"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "initiative_project_idx" ON "initiative" USING btree ("project_id","position");--> statement-breakpoint
ALTER TABLE "issue" ADD CONSTRAINT "issue_initiative_id_initiative_id_fk" FOREIGN KEY ("initiative_id") REFERENCES "public"."initiative"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_activity" ADD CONSTRAINT "issue_activity_initiative_id_initiative_id_fk" FOREIGN KEY ("initiative_id") REFERENCES "public"."initiative"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "issue_activity_initiative_idx" ON "issue_activity" USING btree ("initiative_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "issue_activity" ADD CONSTRAINT "issue_activity_owner_check" CHECK (("issue_activity"."issue_id" IS NOT NULL) <> ("issue_activity"."initiative_id" IS NOT NULL));