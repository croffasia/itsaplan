ALTER TABLE "initiative" DROP CONSTRAINT "initiative_project_id_project_id_fk";
--> statement-breakpoint
ALTER TABLE "issue" DROP CONSTRAINT "issue_project_id_project_id_fk";
--> statement-breakpoint
ALTER TABLE "issue_field_option" DROP CONSTRAINT "issue_field_option_issue_id_issue_id_fk";
--> statement-breakpoint
ALTER TABLE "issue_field_value" DROP CONSTRAINT "issue_field_value_issue_id_issue_id_fk";
--> statement-breakpoint
ALTER TABLE "issue_label" DROP CONSTRAINT "issue_label_issue_id_issue_id_fk";
--> statement-breakpoint
ALTER TABLE "issue_type" DROP CONSTRAINT "issue_type_project_id_project_id_fk";
--> statement-breakpoint
ALTER TABLE "label" DROP CONSTRAINT "label_project_id_project_id_fk";
--> statement-breakpoint
ALTER TABLE "label_group" DROP CONSTRAINT "label_group_project_id_project_id_fk";
--> statement-breakpoint
ALTER TABLE "project_action" DROP CONSTRAINT "project_action_project_id_project_id_fk";
--> statement-breakpoint
ALTER TABLE "project_column" DROP CONSTRAINT "project_column_project_id_project_id_fk";
--> statement-breakpoint
ALTER TABLE "project_dashboard" DROP CONSTRAINT "project_dashboard_project_id_project_id_fk";
--> statement-breakpoint
ALTER TABLE "project_view" DROP CONSTRAINT "project_view_project_id_project_id_fk";
--> statement-breakpoint
ALTER TABLE "initiative" ADD CONSTRAINT "initiative_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue" ADD CONSTRAINT "issue_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_field_option" ADD CONSTRAINT "issue_field_option_issue_id_issue_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issue"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_field_value" ADD CONSTRAINT "issue_field_value_issue_id_issue_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issue"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_label" ADD CONSTRAINT "issue_label_issue_id_issue_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issue"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_type" ADD CONSTRAINT "issue_type_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "label" ADD CONSTRAINT "label_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "label_group" ADD CONSTRAINT "label_group_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_action" ADD CONSTRAINT "project_action_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_column" ADD CONSTRAINT "project_column_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_dashboard" ADD CONSTRAINT "project_dashboard_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_view" ADD CONSTRAINT "project_view_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;