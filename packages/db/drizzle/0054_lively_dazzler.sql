CREATE TABLE "note_board_member" (
	"board_id" integer NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "note_board_member_board_id_user_id_pk" PRIMARY KEY("board_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "note_board_member" ADD CONSTRAINT "note_board_member_board_id_note_board_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."note_board"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_board_member" ADD CONSTRAINT "note_board_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "note_board_member_user_idx" ON "note_board_member" USING btree ("user_id");