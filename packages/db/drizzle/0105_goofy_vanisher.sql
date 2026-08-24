CREATE TABLE "issue_status" (
	"id" serial PRIMARY KEY NOT NULL,
	"issue_id" integer NOT NULL,
	"column_id" integer,
	"column_name" text,
	"state_type" text,
	"entered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"left_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "issue_status" ADD CONSTRAINT "issue_status_issue_id_issue_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."issue"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issue_status" ADD CONSTRAINT "issue_status_column_id_project_column_id_fk" FOREIGN KEY ("column_id") REFERENCES "public"."project_column"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "issue_status_issue_idx" ON "issue_status" USING btree ("issue_id","entered_at");--> statement-breakpoint
CREATE INDEX "issue_status_column_idx" ON "issue_status" USING btree ("column_id") WHERE "issue_status"."column_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "issue_status_open_idx" ON "issue_status" USING btree ("issue_id") WHERE "issue_status"."left_at" IS NULL;--> statement-breakpoint

-- The whole history, rebuilt from the 'status' entries of the change log. Migration
-- 0102 resolved the column id and the state type of both sides of every such entry,
-- so this needs no name matching of its own. A side it left without an id keeps its
-- text alone: column_id and state_type stay NULL, and a stretch whose state type is
-- NULL never counts as completed.
--
-- The rebuild runs in batches over issue.id.
DO $$
DECLARE
  lo integer := (SELECT min(id) FROM issue);
  hi integer := (SELECT max(id) FROM issue);
  batch integer := 5000;
BEGIN
  WHILE lo IS NOT NULL AND lo <= hi LOOP

    INSERT INTO issue_status (issue_id, column_id, column_name, state_type, entered_at, left_at)
    WITH e AS (
      SELECT a.issue_id,
             a.created_at,
             a.payload,
             row_number() OVER w AS rn,
             count(*) OVER (PARTITION BY a.issue_id) AS n,
             lead(a.created_at) OVER w AS next_at
        FROM issue_activity a
       WHERE a.action = 'status'
         AND a.issue_id >= lo AND a.issue_id < lo + batch
      WINDOW w AS (PARTITION BY a.issue_id ORDER BY a.created_at, a.id)
    )
    -- The stretch before the first entry: the issue's creation until that entry, in
    -- the column it moved away from.
    SELECT i.id, c.id, e.payload->'from'->>'value',
           CASE WHEN c.id IS NULL THEN NULL ELSE e.payload->'from'->>'stateType' END,
           i.created_at, e.created_at
      FROM e
      JOIN issue i ON i.id = e.issue_id
      LEFT JOIN project_column c ON c.id = (e.payload->'from'->>'id')::integer
     WHERE e.rn = 1

    UNION ALL

    -- One stretch per entry, in the column it moved into, closed by the next entry.
    -- The last one stays open, unless it names a column the issue is no longer in —
    -- a move that never reached the log — and then it is closed where it opened.
    SELECT e.issue_id, c.id, e.payload->'to'->>'value',
           CASE WHEN c.id IS NULL THEN NULL ELSE e.payload->'to'->>'stateType' END,
           e.created_at,
           CASE WHEN e.rn < e.n THEN e.next_at
                WHEN c.id IS DISTINCT FROM i.column_id THEN e.created_at
           END
      FROM e
      JOIN issue i ON i.id = e.issue_id
      LEFT JOIN project_column c ON c.id = (e.payload->'to'->>'id')::integer

    UNION ALL

    -- The open stretch for an issue the entries leave without one: one that never
    -- changed column, and one whose last entry disagrees with where it sits now.
    SELECT i.id, i.column_id, c.name, c.state_type,
           COALESCE(last_entry.created_at, i.created_at), NULL
      FROM issue i
      JOIN project_column c ON c.id = i.column_id
      LEFT JOIN LATERAL (
        SELECT a.created_at, pc.id AS column_id
          FROM issue_activity a
          LEFT JOIN project_column pc ON pc.id = (a.payload->'to'->>'id')::integer
         WHERE a.action = 'status' AND a.issue_id = i.id
         ORDER BY a.created_at DESC, a.id DESC
         LIMIT 1
      ) last_entry ON true
     WHERE i.id >= lo AND i.id < lo + batch
       AND (last_entry.created_at IS NULL OR last_entry.column_id IS DISTINCT FROM i.column_id);

    lo := lo + batch;
  END LOOP;
END $$;
