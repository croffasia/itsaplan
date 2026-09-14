CREATE TABLE "mind_fact" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"author_user_id" text,
	"braindump_entry_id" integer,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'unverified' NOT NULL,
	"confidence" integer DEFAULT 50 NOT NULL,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mind_fact_category_check" CHECK ("mind_fact"."category" IN ('goals', 'routines', 'people', 'clients', 'infra', 'business', 'knowledge', 'daily_notes', 'archive')),
	CONSTRAINT "mind_fact_source_check" CHECK ("mind_fact"."source" IN ('manual', 'braindump', 'agent')),
	CONSTRAINT "mind_fact_status_check" CHECK ("mind_fact"."status" IN ('unverified', 'verified', 'flagged', 'conflicted')),
	CONSTRAINT "mind_fact_confidence_check" CHECK ("mind_fact"."confidence" BETWEEN 0 AND 100)
);
--> statement-breakpoint
CREATE TABLE "mind_link" (
	"id" serial PRIMARY KEY NOT NULL,
	"from_fact_id" integer NOT NULL,
	"to_fact_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mind_link_pair_unique" UNIQUE("from_fact_id","to_fact_id"),
	CONSTRAINT "mind_link_not_self_check" CHECK ("mind_link"."from_fact_id" <> "mind_link"."to_fact_id")
);
--> statement-breakpoint
CREATE TABLE "mind_recall" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"fact_id" integer,
	"actor" text NOT NULL,
	"actor_kind" text NOT NULL,
	"query" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mind_recall_actor_kind_check" CHECK ("mind_recall"."actor_kind" IN ('agent', 'user'))
);
--> statement-breakpoint
ALTER TABLE "mind_fact" ADD CONSTRAINT "mind_fact_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mind_fact" ADD CONSTRAINT "mind_fact_author_user_id_user_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mind_fact" ADD CONSTRAINT "mind_fact_braindump_entry_id_braindump_entry_id_fk" FOREIGN KEY ("braindump_entry_id") REFERENCES "public"."braindump_entry"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mind_link" ADD CONSTRAINT "mind_link_from_fact_id_mind_fact_id_fk" FOREIGN KEY ("from_fact_id") REFERENCES "public"."mind_fact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mind_link" ADD CONSTRAINT "mind_link_to_fact_id_mind_fact_id_fk" FOREIGN KEY ("to_fact_id") REFERENCES "public"."mind_fact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mind_recall" ADD CONSTRAINT "mind_recall_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mind_recall" ADD CONSTRAINT "mind_recall_fact_id_mind_fact_id_fk" FOREIGN KEY ("fact_id") REFERENCES "public"."mind_fact"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mind_fact_project_category_idx" ON "mind_fact" USING btree ("project_id","category");--> statement-breakpoint
CREATE INDEX "mind_fact_project_updated_idx" ON "mind_fact" USING btree ("project_id","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "mind_link_to_idx" ON "mind_link" USING btree ("to_fact_id");--> statement-breakpoint
CREATE INDEX "mind_recall_project_created_idx" ON "mind_recall" USING btree ("project_id","created_at" DESC NULLS LAST);