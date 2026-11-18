// Requests as people word them, each with the tool that answers it. The catalog test
// asserts how many of them discover finds within its default number of results, so a
// change to the search, to the alias table or to a tool description cannot quietly make
// discovery worse. Add a query when a wording is reported as not found.
export const DISCOVER_QUERIES: [query: string, tool: string][] = [
  // The tools' own words
  ['delete label', 'delete_label'],
  ['list document revisions', 'list_document_revisions'],
  ['unread notification count', 'get_unread_notification_count'],
  ['archive issue', 'archive_issue'],
  ['create webhook', 'create_webhook'],
  ['issue activity', 'list_issue_activity'],
  ['project members', 'list_members'],
  ['finish cycle', 'finish_cycle'],

  // Another word for the resource
  ['create wiki page', 'create_document'],
  ['wiki page history', 'list_document_revisions'],
  ['comment on a doc', 'add_document_comment'],
  ['export wiki page as markdown', 'export_document'],
  ['archive ticket', 'archive_issue'],
  ['move task to another project', 'move_issue'],
  ['ticket history', 'list_issue_activity'],
  ['list sprints', 'list_cycles'],
  ['start next sprint', 'start_next_cycle'],
  ['create epic', 'create_initiative'],
  ['list epics', 'list_initiatives'],
  ['add status', 'create_column'],
  ['reorder board columns', 'reorder_columns'],
  ['create tag', 'create_label'],
  ['inbox', 'list_notifications'],
  ['mark inbox read', 'mark_all_notifications_read'],
  ['list bots', 'list_ai_agents'],
  ['whiteboard', 'list_note_boards'],
  ['saved filters', 'list_views'],
  ['people on the project', 'list_members'],
  ['add todo list to ticket', 'create_checklist'],
  ['hours spent on task', 'list_worklogs'],
  ['remove follower from ticket', 'remove_issue_watcher'],
  ['burndown chart', 'get_project_burnup'],

  // Another word for the action
  ['edit comment', 'update_comment'],
  ['remove comment', 'delete_comment'],
  ['rename label', 'update_label'],
  ['close sprint', 'finish_cycle'],
  ['clone project', 'copy_project'],
  ['copy wiki page', 'duplicate_document'],
  ['unarchive ticket', 'restore_issue'],
  ['kick user from project', 'remove_member'],
  ['cancel invite', 'delete_invite'],
  ['resend invite', 'send_invite_email'],
  ['reset agent api key', 'regenerate_ai_agent_key'],
  ['share my private view', 'publish_view'],
  ['upload file to ticket', 'add_attachment'],
  ['log time on ticket', 'create_worklog'],
  ['subscribe user to ticket', 'add_issue_watcher'],
  ['block ticket by another ticket', 'link_issues'],
  ['star project', 'update_project_preferences'],

  // A field of the resource, which only the input schema may name
  ['set due date on ticket', 'update_issue'],
  ['change assignee', 'update_issue'],
  ['set wip limit', 'update_column'],
  ['change sprint goal', 'update_cycle'],
  ['set target date of epic', 'update_initiative'],
  ['agent temperature', 'update_ai_agent'],
  ['make wiki page private', 'set_document_access'],
];
