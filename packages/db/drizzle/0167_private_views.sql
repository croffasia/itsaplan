ALTER TABLE "project_view" ADD COLUMN "is_private" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "project_view" ADD COLUMN "owner_user_id" text;--> statement-breakpoint
ALTER TABLE "project_view" ADD CONSTRAINT "project_view_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_view_owner_idx" ON "project_view" USING btree ("owner_user_id");--> statement-breakpoint
ALTER TABLE "project_view" ADD CONSTRAINT "project_view_private_owner_check" CHECK ("project_view"."is_private" = ("project_view"."owner_user_id" is not null));