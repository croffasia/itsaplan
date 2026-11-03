CREATE TABLE "project_template" (
	"id" serial PRIMARY KEY NOT NULL,
	"workspace_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"snapshot" jsonb NOT NULL,
	"all_teams" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_template_team" (
	"template_id" integer NOT NULL,
	"team_id" integer NOT NULL,
	CONSTRAINT "project_template_team_template_id_team_id_pk" PRIMARY KEY("template_id","team_id")
);
--> statement-breakpoint
ALTER TABLE "project_template" ADD CONSTRAINT "project_template_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_template_team" ADD CONSTRAINT "project_template_team_template_id_project_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."project_template"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_template_team" ADD CONSTRAINT "project_template_team_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_template_workspace_idx" ON "project_template" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "project_template_team_team_idx" ON "project_template_team" USING btree ("team_id");--> statement-breakpoint
-- Moves each template stored as a project into a snapshot of the workspace, limited to the
-- team that held it. The snapshot has the shape of ProjectSnapshot (apps/api
-- modules/projects/copy.ts); the template project held only what was saved, so it all goes.
-- Templates of different teams now share the workspace's list, so where two teams of one
-- workspace hold a template of the same name, each takes its team's name after it.
DO $$
DECLARE
  source record;
  moved integer;
BEGIN
  FOR source IN
    SELECT p.*, t."workspace_id" AS "template_workspace_id",
      CASE WHEN EXISTS (
        SELECT 1 FROM "project" o JOIN "team" ot ON ot."id" = o."team_id"
        WHERE o."is_template" AND ot."workspace_id" = t."workspace_id"
          AND o."team_id" <> p."team_id" AND lower(o."name") = lower(p."name")
      ) THEN p."name" || ' (' || t."name" || ')' ELSE p."name" END AS "template_name"
    FROM "project" p JOIN "team" t ON t."id" = p."team_id"
    WHERE p."is_template"
  LOOP
    INSERT INTO "project_template" ("workspace_id", "name", "description", "snapshot", "all_teams", "created_at")
    VALUES (
      source."template_workspace_id",
      source."template_name",
      source."description",
      jsonb_build_object(
        'flags', jsonb_build_object(
          'initiativesEnabled', source."initiatives_enabled",
          'dashboardsEnabled', source."dashboards_enabled",
          'documentsEnabled', source."documents_enabled",
          'notesEnabled', source."notes_enabled",
          'cyclesEnabled', source."cycles_enabled",
          'subtasksEnabled', source."subtasks_enabled",
          'checklistsEnabled', source."checklists_enabled",
          'issueStatsEnabled', source."issue_stats_enabled",
          'pointsEstimateEnabled', source."points_estimate_enabled",
          'timeEstimateEnabled', source."time_estimate_enabled",
          'timeLoggingEnabled', source."time_logging_enabled"
        ),
        'columns', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', c."id", 'name', c."name", 'stateType', c."state_type", 'color', c."color",
            'position', c."position", 'wipLimit', c."wip_limit", 'wipMode', c."wip_mode"
          ) ORDER BY c."position")
          FROM "project_column" c WHERE c."project_id" = source."id"
        ), '[]'::jsonb),
        'issueTypes', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', x."id", 'name', x."name", 'icon', x."icon", 'color', x."color",
            'isDefault', x."is_default", 'position', x."position"
          ) ORDER BY x."position")
          FROM "issue_type" x WHERE x."project_id" = source."id"
        ), '[]'::jsonb),
        'labelGroups', COALESCE((
          SELECT jsonb_agg(jsonb_build_object('id', g."id", 'name', g."name", 'color', g."color") ORDER BY g."id")
          FROM "label_group" g WHERE g."project_id" = source."id"
        ), '[]'::jsonb),
        'labels', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', l."id", 'groupId', l."group_id", 'name', l."name", 'color', l."color"
          ) ORDER BY l."id")
          FROM "label" l WHERE l."project_id" = source."id"
        ), '[]'::jsonb),
        'customFields', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', f."id", 'issueTypeId', f."issue_type_id", 'name', f."name",
            'fieldType', f."field_type", 'memberScope', f."member_scope",
            'showInBody', f."show_in_body", 'position', f."position",
            'options', COALESCE((
              SELECT jsonb_agg(jsonb_build_object(
                'id', o."id", 'value', o."value", 'color', o."color", 'position', o."position"
              ) ORDER BY o."position")
              FROM "custom_field_option" o WHERE o."field_id" = f."id"
            ), '[]'::jsonb)
          ) ORDER BY f."position")
          FROM "custom_field" f WHERE f."project_id" = source."id"
        ), '[]'::jsonb),
        'issueTemplates', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'name', it."name", 'description', it."description",
            'titleTemplate', it."title_template", 'descriptionTemplate', it."description_template",
            'typeId', it."type_id", 'columnId', it."column_id", 'priority', it."priority",
            'labelIds', COALESCE((
              SELECT jsonb_agg(itl."label_id") FROM "issue_template_label" itl
              WHERE itl."template_id" = it."id"
            ), '[]'::jsonb)
          ) ORDER BY it."id")
          FROM "issue_template" it WHERE it."project_id" = source."id"
        ), '[]'::jsonb),
        'views', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'name', v."name", 'icon', v."icon", 'filters', v."filters", 'display', v."display",
            'position', v."position"
          ) ORDER BY v."position", v."id")
          FROM "project_view" v WHERE v."project_id" = source."id" AND NOT v."is_private"
        ), '[]'::jsonb),
        'dashboards', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'name', d."name", 'icon', d."icon", 'layout', d."layout", 'position', d."position"
          ) ORDER BY d."position", d."id")
          FROM "project_dashboard" d WHERE d."project_id" = source."id"
        ), '[]'::jsonb),
        'actions', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'name', a."name", 'icon', a."icon", 'condition', a."condition", 'effect', a."effect",
            'position', a."position"
          ) ORDER BY a."position", a."id")
          FROM "project_action" a WHERE a."project_id" = source."id"
        ), '[]'::jsonb),
        'settings', COALESCE((
          SELECT jsonb_agg(jsonb_build_object('key', s."key", 'value', s."value") ORDER BY s."key")
          FROM "project_setting" s WHERE s."project_id" = source."id" AND s."key" <> 'git'
        ), '[]'::jsonb),
        'sections', '{}'::jsonb
      ),
      false,
      source."created_at"
    )
    RETURNING "id" INTO moved;
    INSERT INTO "project_template_team" ("template_id", "team_id") VALUES (moved, source."team_id");
  END LOOP;
END $$;--> statement-breakpoint
DELETE FROM "project" WHERE "is_template";--> statement-breakpoint
-- The delete leaves deferred trigger events, which would refuse the ALTER below.
SET CONSTRAINTS ALL IMMEDIATE;--> statement-breakpoint
ALTER TABLE "project" DROP COLUMN "is_template";