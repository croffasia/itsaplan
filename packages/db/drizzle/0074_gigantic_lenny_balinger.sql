ALTER TABLE "apikey" ALTER COLUMN "rate_limit_time_window" SET DEFAULT 1000;--> statement-breakpoint
ALTER TABLE "apikey" ALTER COLUMN "rate_limit_max" SET DEFAULT 100;