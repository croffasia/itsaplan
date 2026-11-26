DROP INDEX "user_git_account_login_idx";--> statement-breakpoint
ALTER TABLE "user_git_account" ADD COLUMN "account_id" text NOT NULL;--> statement-breakpoint
CREATE INDEX "user_git_account_account_idx" ON "user_git_account" USING btree ("base_url","account_id");