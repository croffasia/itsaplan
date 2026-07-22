CREATE TABLE "project_invite" (
	"id" serial PRIMARY KEY NOT NULL,
	"token" uuid DEFAULT gen_random_uuid() NOT NULL,
	"project_id" integer NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"invited_by_user_id" text,
	"accepted_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responded_at" timestamp with time zone,
	CONSTRAINT "project_invite_token_unique" UNIQUE("token"),
	CONSTRAINT "project_invite_role_check" CHECK ("project_invite"."role" IN ('owner', 'member')),
	CONSTRAINT "project_invite_status_check" CHECK ("project_invite"."status" IN ('pending', 'accepted', 'rejected'))
);
--> statement-breakpoint
ALTER TABLE "project_invite" ADD CONSTRAINT "project_invite_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_invite" ADD CONSTRAINT "project_invite_invited_by_user_id_user_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_invite" ADD CONSTRAINT "project_invite_accepted_by_user_id_user_id_fk" FOREIGN KEY ("accepted_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "project_invite_pending_uq" ON "project_invite" USING btree ("project_id","email") WHERE "project_invite"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "project_invite_project_idx" ON "project_invite" USING btree ("project_id");