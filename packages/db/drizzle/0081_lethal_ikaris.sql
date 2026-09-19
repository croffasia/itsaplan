CREATE TABLE "phone_call_event" (
	"id" serial PRIMARY KEY NOT NULL,
	"event" text NOT NULL,
	"call_id" text,
	"direction" text,
	"external_number" text,
	"internal_number" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "phone_call_event_received_idx" ON "phone_call_event" USING btree ("received_at");