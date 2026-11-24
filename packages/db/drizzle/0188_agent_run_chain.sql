ALTER TABLE "agent_run" ADD COLUMN "started_by_user_id" text;--> statement-breakpoint
ALTER TABLE "agent_run" ADD COLUMN "parent_run_id" integer;--> statement-breakpoint
ALTER TABLE "agent_run" ADD COLUMN "root_run_id" integer;--> statement-breakpoint
ALTER TABLE "agent_run" ADD CONSTRAINT "agent_run_started_by_user_id_user_id_fk" FOREIGN KEY ("started_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_run" ADD CONSTRAINT "agent_run_parent_run_id_agent_run_id_fk" FOREIGN KEY ("parent_run_id") REFERENCES "public"."agent_run"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_run" ADD CONSTRAINT "agent_run_root_run_id_agent_run_id_fk" FOREIGN KEY ("root_run_id") REFERENCES "public"."agent_run"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_run_parent_run_idx" ON "agent_run" USING btree ("parent_run_id") WHERE "agent_run"."parent_run_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "agent_run_root_run_idx" ON "agent_run" USING btree ("root_run_id") WHERE "agent_run"."root_run_id" IS NOT NULL;