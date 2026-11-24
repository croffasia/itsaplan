CREATE INDEX "agent_run_issue_idx" ON "agent_run" USING btree ("issue_id","id" DESC NULLS LAST) WHERE "agent_run"."issue_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "agent_run_source_activity_idx" ON "agent_run" USING btree ("source_activity_id") WHERE "agent_run"."source_activity_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "issue_initiative_idx" ON "issue" USING btree ("initiative_id") WHERE "issue"."initiative_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "notification_issue_idx" ON "notification" USING btree ("issue_id") WHERE "notification"."issue_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "notification_source_activity_idx" ON "notification" USING btree ("source_activity_id") WHERE "notification"."source_activity_id" IS NOT NULL;