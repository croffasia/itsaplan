CREATE TABLE "project_document_member" (
	"document_id" integer NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "project_document_member_document_id_user_id_pk" PRIMARY KEY("document_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "project_document_member" ADD CONSTRAINT "project_document_member_document_id_project_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."project_document"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_document_member" ADD CONSTRAINT "project_document_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_document_member_user_idx" ON "project_document_member" USING btree ("user_id");