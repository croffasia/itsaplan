CREATE TABLE "project_view_favorite" (
	"view_id" integer NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "project_view_favorite_view_id_user_id_pk" PRIMARY KEY("view_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "project_view_favorite" ADD CONSTRAINT "project_view_favorite_view_id_project_view_id_fk" FOREIGN KEY ("view_id") REFERENCES "public"."project_view"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_view_favorite" ADD CONSTRAINT "project_view_favorite_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;