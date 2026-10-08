CREATE TABLE "workspace" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_manager" (
	"workspace_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'admin' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_manager_workspace_id_user_id_pk" PRIMARY KEY("workspace_id","user_id"),
	CONSTRAINT "workspace_manager_role_check" CHECK ("workspace_manager"."role" IN ('owner', 'admin'))
);
--> statement-breakpoint
ALTER TABLE "team" ADD COLUMN "workspace_id" integer;--> statement-breakpoint
INSERT INTO "workspace" ("name") VALUES ('Workspace');--> statement-breakpoint
UPDATE "team" SET "workspace_id" = (SELECT min("id") FROM "workspace");--> statement-breakpoint
ALTER TABLE "team" ALTER COLUMN "workspace_id" SET NOT NULL;--> statement-breakpoint
INSERT INTO "workspace_manager" ("workspace_id", "user_id", "role")
SELECT (SELECT min("id") FROM "workspace"), "id", 'owner' FROM "user"
WHERE "role" = 'god' ORDER BY "created_at" LIMIT 1;--> statement-breakpoint
ALTER TABLE "workspace_manager" ADD CONSTRAINT "workspace_manager_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_manager" ADD CONSTRAINT "workspace_manager_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_manager_owner_uq" ON "workspace_manager" USING btree ("workspace_id") WHERE "workspace_manager"."role" = 'owner';--> statement-breakpoint
CREATE INDEX "workspace_manager_user_idx" ON "workspace_manager" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "team" ADD CONSTRAINT "team_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "team_workspace_idx" ON "team" USING btree ("workspace_id");