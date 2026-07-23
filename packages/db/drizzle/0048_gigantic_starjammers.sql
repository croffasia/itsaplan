CREATE TABLE "note_board" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"owner_user_id" text,
	"name" text NOT NULL,
	"canvas" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "note_board" ADD CONSTRAINT "note_board_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_board" ADD CONSTRAINT "note_board_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "note_board_project_idx" ON "note_board" USING btree ("project_id","updated_at");