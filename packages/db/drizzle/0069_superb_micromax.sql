CREATE TABLE "note_board_image" (
	"id" serial PRIMARY KEY NOT NULL,
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"board_id" integer NOT NULL,
	"uploaded_by_user_id" text,
	"s3_key" text NOT NULL,
	"filename" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "note_board_image_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
ALTER TABLE "note_board_image" ADD CONSTRAINT "note_board_image_board_id_note_board_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."note_board"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_board_image" ADD CONSTRAINT "note_board_image_uploaded_by_user_id_user_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "note_board_image_board_idx" ON "note_board_image" USING btree ("board_id","created_at");