CREATE TABLE "cycle" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"name" text NOT NULL,
	"goal" text DEFAULT '' NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cycle_dates_check" CHECK ("cycle"."end_date" >= "cycle"."start_date")
);
--> statement-breakpoint
ALTER TABLE "issue" ADD COLUMN "cycle_id" integer;--> statement-breakpoint
ALTER TABLE "project" ADD COLUMN "cycles_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "cycle" ADD CONSTRAINT "cycle_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cycle_project_idx" ON "cycle" USING btree ("project_id","start_date");--> statement-breakpoint
ALTER TABLE "issue" ADD CONSTRAINT "issue_cycle_id_cycle_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycle"("id") ON DELETE set null ON UPDATE no action;