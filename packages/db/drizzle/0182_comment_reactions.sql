CREATE TABLE "issue_activity_reaction" (
	"activity_id" integer NOT NULL,
	"user_id" text NOT NULL,
	"emoji" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "issue_activity_reaction_activity_id_user_id_emoji_pk" PRIMARY KEY("activity_id","user_id","emoji")
);
--> statement-breakpoint
ALTER TABLE "issue_activity_reaction" ADD CONSTRAINT "issue_activity_reaction_activity_id_issue_activity_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."issue_activity"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_activity_reaction" ADD CONSTRAINT "issue_activity_reaction_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "issue_activity_reaction_user_idx" ON "issue_activity_reaction" USING btree ("user_id");--> statement-breakpoint
-- A reaction reaches its issue through the comment it is on. When the comment is
-- deleted with its reactions, the comment's own trigger moves the issue. Only the
-- issue screen shows reactions, so the initiative is not moved.
CREATE FUNCTION rev_activity_reaction() RETURNS trigger AS $$
DECLARE
  target_id integer;
  p integer;
BEGIN
  SELECT a.issue_id, s.project_id INTO target_id, p
  FROM issue_activity a JOIN issue s ON s.id = a.issue_id
  WHERE a.id = CASE WHEN TG_OP = 'DELETE' THEN OLD.activity_id ELSE NEW.activity_id END;
  IF p IS NULL THEN RETURN NULL; END IF;
  PERFORM bump_rev('issue:' || target_id, p);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER issue_activity_reaction_rev AFTER INSERT OR DELETE ON issue_activity_reaction
  FOR EACH ROW EXECUTE FUNCTION rev_activity_reaction();
