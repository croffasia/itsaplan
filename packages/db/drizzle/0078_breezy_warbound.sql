CREATE TABLE "command_center_snooze" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"signal_id" text NOT NULL,
	"until" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "command_center_snooze_unique" UNIQUE("project_id","user_id","signal_id")
);
--> statement-breakpoint
ALTER TABLE "command_center_snooze" ADD CONSTRAINT "command_center_snooze_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "command_center_snooze" ADD CONSTRAINT "command_center_snooze_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "command_center_snooze_member_idx" ON "command_center_snooze" USING btree ("project_id","user_id","until");