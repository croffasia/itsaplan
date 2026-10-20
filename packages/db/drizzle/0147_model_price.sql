CREATE TABLE "model_price" (
	"id" serial PRIMARY KEY NOT NULL,
	"workspace_id" integer NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"input" double precision NOT NULL,
	"output" double precision NOT NULL,
	"cache_read" double precision,
	"cache_write" double precision,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "model_price_workspace_id_provider_model_unique" UNIQUE("workspace_id","provider","model"),
	CONSTRAINT "model_price_rates_check" CHECK ("model_price"."input" >= 0 AND "model_price"."output" >= 0 AND coalesce("model_price"."cache_read", 0) >= 0 AND coalesce("model_price"."cache_write", 0) >= 0)
);
--> statement-breakpoint
ALTER TABLE "model_price" ADD CONSTRAINT "model_price_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;