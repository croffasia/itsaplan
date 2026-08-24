-- The three text columns move into payload. Every entry keeps the text it had, so
-- the feed reads exactly as before; on top of that each side that names a row gets
-- that row's id, resolved by matching the stored name against the project's current
-- rows. A name that matches none or several rows keeps the text alone.
--
-- The rewrite runs in batches over the primary key. The revision trigger is off for
-- it: the entries say the same thing after the migration as before, so nothing a
-- client caches has changed, and firing it per row would bump every issue in the
-- instance.
ALTER TABLE "issue_activity" DISABLE TRIGGER "issue_activity_rev";--> statement-breakpoint

DO $$
DECLARE
  lo integer := (SELECT min(id) FROM issue_activity);
  hi integer := (SELECT max(id) FROM issue_activity);
  batch integer := 5000;
BEGIN
  WHILE lo IS NOT NULL AND lo <= hi LOOP

    -- The text, as the three columns held it.
    UPDATE issue_activity a
       SET payload =
             CASE WHEN a.subject IS NULL THEN '{}'::jsonb
                  ELSE jsonb_build_object('subject', jsonb_build_object('value', a.subject)) END
          || CASE WHEN a.from_text IS NULL THEN '{}'::jsonb
                  ELSE jsonb_build_object('from', jsonb_build_object('value', a.from_text)) END
          || CASE WHEN a.to_text IS NULL THEN '{}'::jsonb
                  ELSE jsonb_build_object('to', jsonb_build_object('value', a.to_text)) END
     WHERE a.id >= lo AND a.id < lo + batch
       AND (a.subject IS NOT NULL OR a.from_text IS NOT NULL OR a.to_text IS NOT NULL);

    -- A status change names two columns of the issue's project. The state type is
    -- the one that column carries now — what it was at the time is not recorded
    -- anywhere. From this release on it is written at the moment of the move.
    UPDATE issue_activity a
       SET payload = a.payload
          || coalesce((SELECT jsonb_build_object('from', (a.payload->'from')
                                || jsonb_build_object('id', min(c.id), 'stateType', min(c.state_type)))
                         FROM project_column c
                         JOIN issue i ON i.id = a.issue_id
                        WHERE c.project_id = i.project_id
                          AND c.name = a.payload->'from'->>'value'
                       HAVING count(*) = 1), '{}'::jsonb)
          || coalesce((SELECT jsonb_build_object('to', (a.payload->'to')
                                || jsonb_build_object('id', min(c.id), 'stateType', min(c.state_type)))
                         FROM project_column c
                         JOIN issue i ON i.id = a.issue_id
                        WHERE c.project_id = i.project_id
                          AND c.name = a.payload->'to'->>'value'
                       HAVING count(*) = 1), '{}'::jsonb)
     WHERE a.id >= lo AND a.id < lo + batch
       AND a.action = 'status' AND a.issue_id IS NOT NULL;

    -- Issue type.
    UPDATE issue_activity a
       SET payload = a.payload
          || coalesce((SELECT jsonb_build_object('from', (a.payload->'from') || jsonb_build_object('id', min(y.id)))
                         FROM issue_type y
                         JOIN issue i ON i.id = a.issue_id
                        WHERE y.project_id = i.project_id
                          AND y.name = a.payload->'from'->>'value'
                       HAVING count(*) = 1), '{}'::jsonb)
          || coalesce((SELECT jsonb_build_object('to', (a.payload->'to') || jsonb_build_object('id', min(y.id)))
                         FROM issue_type y
                         JOIN issue i ON i.id = a.issue_id
                        WHERE y.project_id = i.project_id
                          AND y.name = a.payload->'to'->>'value'
                       HAVING count(*) = 1), '{}'::jsonb)
     WHERE a.id >= lo AND a.id < lo + batch
       AND a.action = 'type' AND a.issue_id IS NOT NULL;

    -- Cycle.
    UPDATE issue_activity a
       SET payload = a.payload
          || coalesce((SELECT jsonb_build_object('from', (a.payload->'from') || jsonb_build_object('id', min(y.id)))
                         FROM cycle y
                         JOIN issue i ON i.id = a.issue_id
                        WHERE y.project_id = i.project_id
                          AND y.name = a.payload->'from'->>'value'
                       HAVING count(*) = 1), '{}'::jsonb)
          || coalesce((SELECT jsonb_build_object('to', (a.payload->'to') || jsonb_build_object('id', min(y.id)))
                         FROM cycle y
                         JOIN issue i ON i.id = a.issue_id
                        WHERE y.project_id = i.project_id
                          AND y.name = a.payload->'to'->>'value'
                       HAVING count(*) = 1), '{}'::jsonb)
     WHERE a.id >= lo AND a.id < lo + batch
       AND a.action = 'cycle' AND a.issue_id IS NOT NULL;

    -- Initiative, by title.
    UPDATE issue_activity a
       SET payload = a.payload
          || coalesce((SELECT jsonb_build_object('from', (a.payload->'from') || jsonb_build_object('id', min(n.id)))
                         FROM initiative n
                         JOIN issue i ON i.id = a.issue_id
                        WHERE n.project_id = i.project_id
                          AND n.title = a.payload->'from'->>'value'
                       HAVING count(*) = 1), '{}'::jsonb)
          || coalesce((SELECT jsonb_build_object('to', (a.payload->'to') || jsonb_build_object('id', min(n.id)))
                         FROM initiative n
                         JOIN issue i ON i.id = a.issue_id
                        WHERE n.project_id = i.project_id
                          AND n.title = a.payload->'to'->>'value'
                       HAVING count(*) = 1), '{}'::jsonb)
     WHERE a.id >= lo AND a.id < lo + batch
       AND a.action = 'initiative' AND a.issue_id IS NOT NULL;

    -- The people an issue or an initiative names, matched among the members of its
    -- project. Two members with the same name resolve to neither.
    UPDATE issue_activity a
       SET payload = a.payload
          || coalesce((SELECT jsonb_build_object('from', (a.payload->'from') || jsonb_build_object('id', min(u.id)))
                         FROM "user" u
                         JOIN project_member m ON m.user_id = u.id
                         LEFT JOIN issue i ON i.id = a.issue_id
                         LEFT JOIN initiative n ON n.id = a.initiative_id
                        WHERE m.project_id = coalesce(i.project_id, n.project_id)
                          AND u.name = a.payload->'from'->>'value'
                       HAVING count(*) = 1), '{}'::jsonb)
          || coalesce((SELECT jsonb_build_object('to', (a.payload->'to') || jsonb_build_object('id', min(u.id)))
                         FROM "user" u
                         JOIN project_member m ON m.user_id = u.id
                         LEFT JOIN issue i ON i.id = a.issue_id
                         LEFT JOIN initiative n ON n.id = a.initiative_id
                        WHERE m.project_id = coalesce(i.project_id, n.project_id)
                          AND u.name = a.payload->'to'->>'value'
                       HAVING count(*) = 1), '{}'::jsonb)
     WHERE a.id >= lo AND a.id < lo + batch
       AND a.action IN ('assignee', 'delegate', 'owner');

    -- Labels: added ones sit on the 'to' side, removed ones on the 'from' side.
    UPDATE issue_activity a
       SET payload = a.payload
          || coalesce((SELECT jsonb_build_object('from', (a.payload->'from') || jsonb_build_object('id', min(l.id)))
                         FROM label l
                         LEFT JOIN issue i ON i.id = a.issue_id
                         LEFT JOIN initiative n ON n.id = a.initiative_id
                        WHERE l.project_id = coalesce(i.project_id, n.project_id)
                          AND l.name = a.payload->'from'->>'value'
                       HAVING count(*) = 1), '{}'::jsonb)
          || coalesce((SELECT jsonb_build_object('to', (a.payload->'to') || jsonb_build_object('id', min(l.id)))
                         FROM label l
                         LEFT JOIN issue i ON i.id = a.issue_id
                         LEFT JOIN initiative n ON n.id = a.initiative_id
                        WHERE l.project_id = coalesce(i.project_id, n.project_id)
                          AND l.name = a.payload->'to'->>'value'
                       HAVING count(*) = 1), '{}'::jsonb)
     WHERE a.id >= lo AND a.id < lo + batch
       AND a.action IN ('label_add', 'label_remove');

    -- A 'field' entry names its custom field as the subject, and its new value on the
    -- 'to' side. That value is a row of its own for the two field types that hold
    -- one: the chosen option of a select, the chosen person of a member field. A
    -- multi_select names several options at once and keeps its text.
    UPDATE issue_activity a
       SET payload = a.payload
          || coalesce((SELECT jsonb_build_object('subject', (a.payload->'subject') || jsonb_build_object('id', min(f.id)))
                         FROM custom_field f
                         JOIN issue i ON i.id = a.issue_id
                        WHERE f.project_id = i.project_id
                          AND f.name = a.payload->'subject'->>'value'
                       HAVING count(*) = 1), '{}'::jsonb)
          || coalesce((SELECT jsonb_build_object('to', (a.payload->'to') || jsonb_build_object('id', min(o.id)))
                         FROM custom_field_option o
                         JOIN custom_field f ON f.id = o.field_id AND f.field_type = 'select'
                         JOIN issue i ON i.id = a.issue_id
                        WHERE f.project_id = i.project_id
                          AND f.name = a.payload->'subject'->>'value'
                          AND o.value = a.payload->'to'->>'value'
                       HAVING count(*) = 1), '{}'::jsonb)
          || coalesce((SELECT jsonb_build_object('to', (a.payload->'to') || jsonb_build_object('id', min(u.id)))
                         FROM "user" u
                         JOIN project_member m ON m.user_id = u.id
                         JOIN issue i ON i.id = a.issue_id AND m.project_id = i.project_id
                         JOIN custom_field f ON f.project_id = i.project_id
                                            AND f.field_type = 'member'
                                            AND f.name = a.payload->'subject'->>'value'
                        WHERE u.name = a.payload->'to'->>'value'
                       HAVING count(*) = 1), '{}'::jsonb)
     WHERE a.id >= lo AND a.id < lo + batch
       AND a.action = 'field' AND a.issue_id IS NOT NULL;

    -- Checklists, by title among the ones the issue has. An item entry names its
    -- checklist as the subject; a checklist entry names it on the side it changed.
    UPDATE issue_activity a
       SET payload = a.payload
          || coalesce((SELECT jsonb_build_object('subject', (a.payload->'subject') || jsonb_build_object('id', min(k.id)))
                         FROM issue_checklist k
                        WHERE k.issue_id = a.issue_id
                          AND k.title = a.payload->'subject'->>'value'
                       HAVING count(*) = 1), '{}'::jsonb)
          || coalesce((SELECT jsonb_build_object('from', (a.payload->'from') || jsonb_build_object('id', min(k.id)))
                         FROM issue_checklist k
                        WHERE k.issue_id = a.issue_id
                          AND k.title = a.payload->'from'->>'value'
                       HAVING count(*) = 1), '{}'::jsonb)
          || coalesce((SELECT jsonb_build_object('to', (a.payload->'to') || jsonb_build_object('id', min(k.id)))
                         FROM issue_checklist k
                        WHERE k.issue_id = a.issue_id
                          AND k.title = a.payload->'to'->>'value'
                       HAVING count(*) = 1), '{}'::jsonb)
     WHERE a.id >= lo AND a.id < lo + batch
       AND a.action IN ('checklist_add', 'checklist_rename', 'checklist_remove',
                        'checklist_item_add', 'checklist_item_remove')
       AND a.issue_id IS NOT NULL;

    -- The other issue a relation, a parent or a subtask entry names, by the
    -- identifier it was written with.
    UPDATE issue_activity a
       SET payload = a.payload
          || coalesce((SELECT jsonb_build_object('from', (a.payload->'from') || jsonb_build_object('id', min(o.id)))
                         FROM issue o
                         JOIN project p ON p.id = o.project_id
                        WHERE p.key || '-' || o.sequence_number = a.payload->'from'->>'value'
                       HAVING count(*) = 1), '{}'::jsonb)
          || coalesce((SELECT jsonb_build_object('to', (a.payload->'to') || jsonb_build_object('id', min(o.id)))
                         FROM issue o
                         JOIN project p ON p.id = o.project_id
                        WHERE p.key || '-' || o.sequence_number = a.payload->'to'->>'value'
                       HAVING count(*) = 1), '{}'::jsonb)
     WHERE a.id >= lo AND a.id < lo + batch
       AND a.action IN ('parent', 'subtask_add', 'subtask_remove', 'link_add', 'link_remove')
       AND a.issue_id IS NOT NULL;

    -- A pull request entry holds "owner/repo#42" as its text; the repository and the
    -- number come out of it.
    UPDATE issue_activity a
       SET payload = jsonb_set(a.payload, '{from}', (a.payload->'from')
             || jsonb_build_object('repo', split_part(a.payload->'from'->>'value', '#', 1),
                                   'number', split_part(a.payload->'from'->>'value', '#', 2)::integer))
     WHERE a.id >= lo AND a.id < lo + batch
       AND a.action IN ('git_pr', 'github_pr')
       AND a.payload->'from'->>'value' ~ '^.+#[0-9]+$';

    lo := lo + batch;
  END LOOP;
END $$;--> statement-breakpoint

ALTER TABLE "issue_activity" ENABLE TRIGGER "issue_activity_rev";--> statement-breakpoint
ALTER TABLE "issue_activity" DROP COLUMN "subject";--> statement-breakpoint
ALTER TABLE "issue_activity" DROP COLUMN "from_text";--> statement-breakpoint
ALTER TABLE "issue_activity" DROP COLUMN "to_text";
