CREATE TABLE "initiative_favorite" (
	"initiative_id" integer NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "initiative_favorite_initiative_id_user_id_pk" PRIMARY KEY("initiative_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "initiative_favorite" ADD CONSTRAINT "initiative_favorite_initiative_id_initiative_id_fk" FOREIGN KEY ("initiative_id") REFERENCES "public"."initiative"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "initiative_favorite" ADD CONSTRAINT "initiative_favorite_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "initiative_favorite_user_idx" ON "initiative_favorite" USING btree ("user_id");