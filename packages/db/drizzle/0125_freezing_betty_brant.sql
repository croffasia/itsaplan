CREATE TABLE "initiative_attachment" (
	"id" serial PRIMARY KEY NOT NULL,
	"public_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"initiative_id" integer NOT NULL,
	"s3_key" text NOT NULL,
	"filename" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "initiative_attachment_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
ALTER TABLE "initiative_attachment" ADD CONSTRAINT "initiative_attachment_initiative_id_initiative_id_fk" FOREIGN KEY ("initiative_id") REFERENCES "public"."initiative"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "initiative_attachment_initiative_idx" ON "initiative_attachment" USING btree ("initiative_id");--> statement-breakpoint
CREATE TRIGGER initiative_attachment_rev AFTER INSERT OR UPDATE OR DELETE ON initiative_attachment
  FOR EACH ROW EXECUTE FUNCTION rev_initiative_child('initiative_id');
