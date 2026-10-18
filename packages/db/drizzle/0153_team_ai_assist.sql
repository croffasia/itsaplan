CREATE TABLE "team_ai_assist" (
	"team_id" integer PRIMARY KEY NOT NULL,
	"credential_id" integer NOT NULL,
	"model" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "team_ai_assist" ADD CONSTRAINT "team_ai_assist_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_ai_assist" ADD CONSTRAINT "team_ai_assist_credential_id_integration_credential_id_fk" FOREIGN KEY ("credential_id") REFERENCES "public"."integration_credential"("id") ON DELETE cascade ON UPDATE no action;