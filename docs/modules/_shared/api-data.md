# API data model

Code: `packages/db/src/schema/app.ts` (85 tables), `packages/db/src/schema/auth.ts` (14),
`packages/db/src/schema/scim.ts` (4), `packages/db/drizzle`, `packages/db/src/migrate.ts`. Commit `42fd2f40`.

## 1. Purpose

Where each area of the app stores its data, so a module document can name its tables.

## 2. Routes and screens

None.

## 3. Components

Tables in `packages/db/src/schema/app.ts`, by area (name@line):

| Area | Tables |
| --- | --- |
| Instance | app_setting@31, app_secret@43 |
| Workspace and team | workspace@54, workspace_manager@76, team@100, team_member@127, team_role@293, team_invite@365 |
| Project | project@156, project_setting@203, project_member@323, project_column@415, issue_type@450, label_group@469, label@483 |
| User | user_preference@237, user_notification_preference@998, user_telegram_account@1022 |
| AI agents | ai_agent@510, agent_schedule@599, model_price@657, agent_run@684, agent_run_trace@745, agent_chat_thread@766, agent_chat_message@794, agent_chat_event@833, agent_chat_usage@858, agent_chat_favorite@876, agent_skill@1107, agent_skill_link@1133, agent_tool@1155, agent_tool_link@1177, agent_field_trigger@1247 |
| Integrations | integration_credential@900, git_provider_connection@920, git_managed_repository@939, webhook@2259, webhook_delivery@2284 |
| Notifications | team_notification_setting@980, notification_delivery@1075, notification@2407 |
| Custom fields and templates | custom_field@1196, custom_field_option@1229, issue_template@1271, issue_template_label@1293 |
| Initiatives and cycles | initiative@1312, initiative_label@1343, initiative_attachment@1359, cycle@1383 |
| Issues | issue@1408, issue_key_alias@1500, issue_cycle@1522, issue_status@1553, issue_label@1585, issue_link@1601, issue_watcher@1639, issue_field_value@1654, issue_field_option@1679, issue_attachment@1698, issue_development_link@1715, issue_development_check@1746, chat_attachment@1771, issue_checklist@1820, issue_checklist_item@1835, issue_worklog@1855, issue_activity@1914 |
| Views and dashboards | project_view@1958, project_view_favorite@1986, project_dashboard@2003 |
| Documents | project_document@2022, project_document_revision@2070, project_document_preference@2105, project_document_issue@2127, project_document_initiative@2149, document_asset@2172, revision@2457, document_collaboration@2468, document_step@2477, document_comment@2490 |
| Notes and actions | note_board@2197, note_board_member@2217, project_action@2237 |
| Import | issue_import@1795, import_job@2319, import_record@2365 |

Migrations are SQL files in `packages/db/drizzle`, applied by `packages/db/src/migrate.ts`, which dumps
the database first and takes a Postgres advisory lock.

## 4. API endpoints

None.

## 5. Database tables

This document.

## 6. Permissions

None at the data level; access is checked in the API (see `api-auth-permissions.md`).

## 7. Dependencies

Drizzle ORM, PostgreSQL 17.

## 8. Running it in isolation

A module that stays on the API needs no tables. A module that reimplements the API side would
need the module's tables from the list above and their migrations.

## 9. Unconfirmed claims

- Columns of each table are documented per module, not here.
- Tables in `auth.ts` and `scim.ts` are counted but not listed.
