CREATE TABLE "server" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"customer_id" integer,
	"added_by_user_id" text,
	"label" text NOT NULL,
	"host" text NOT NULL,
	"port" integer DEFAULT 22 NOT NULL,
	"username" text NOT NULL,
	"auth_type" text NOT NULL,
	"credential" jsonb NOT NULL,
	"passphrase" jsonb,
	"host_key_fingerprint" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"last_connected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "server_project_target_unique" UNIQUE("project_id","host","port","username"),
	CONSTRAINT "server_auth_type_check" CHECK ("server"."auth_type" IN ('password', 'key')),
	CONSTRAINT "server_port_check" CHECK ("server"."port" BETWEEN 1 AND 65535)
);
--> statement-breakpoint
CREATE TABLE "server_session" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"server_id" integer NOT NULL,
	"user_id" text,
	"status" text DEFAULT 'open' NOT NULL,
	"error_code" text,
	"bytes_in" bigint DEFAULT 0 NOT NULL,
	"bytes_out" bigint DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	CONSTRAINT "server_session_status_check" CHECK ("server_session"."status" IN ('open', 'closed', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "server" ADD CONSTRAINT "server_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "server" ADD CONSTRAINT "server_customer_id_crm_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."crm_customer"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "server" ADD CONSTRAINT "server_added_by_user_id_user_id_fk" FOREIGN KEY ("added_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "server_session" ADD CONSTRAINT "server_session_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "server_session" ADD CONSTRAINT "server_session_server_id_server_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."server"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "server_session" ADD CONSTRAINT "server_session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "server_project_idx" ON "server" USING btree ("project_id","active");--> statement-breakpoint
CREATE INDEX "server_customer_idx" ON "server" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "server_session_project_started_idx" ON "server_session" USING btree ("project_id","started_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "server_session_server_idx" ON "server_session" USING btree ("server_id","started_at" DESC NULLS LAST);