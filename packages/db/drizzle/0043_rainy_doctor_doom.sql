CREATE TABLE "user_telegram_account" (
	"user_id" text PRIMARY KEY NOT NULL,
	"chat_id" text,
	"username" text,
	"first_name" text,
	"link_code" text,
	"link_code_expires_at" timestamp with time zone,
	"linked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_telegram_account" ADD CONSTRAINT "user_telegram_account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_telegram_account_chat_id_unique" ON "user_telegram_account" USING btree ("chat_id") WHERE "user_telegram_account"."chat_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "user_telegram_account_link_code_unique" ON "user_telegram_account" USING btree ("link_code") WHERE "user_telegram_account"."link_code" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "user_notification_preference" DROP COLUMN "telegram_chat_id";