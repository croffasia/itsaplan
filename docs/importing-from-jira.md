# Importing from Jira

Project Settings → Import/Export → **Jira** imports one Jira Cloud project into a One Health
project. The phases, pausing, rate limits and re-running behave as described in
[Importing from Plane](importing-from-plane.md); this page covers what is specific to Jira.

## What you need

- The Jira Cloud site, e.g. `https://acme.atlassian.net`. Jira Data Center and Server are
  not supported.
- The email of an Atlassian account that can browse the project.
- An API token of that account, created at id.atlassian.com under Security → API tokens.
  The token is stored encrypted, used only by the import, and deleted when the job ends.

## Steps

1. Enter the site URL, email and API token, then **Test connection**. The projects the
   account can browse are listed.
2. Pick the project. Its statuses appear with the category each maps to.
3. Change any status that maps wrongly, choose how to handle unmatched people, and
   **Start import**.

## What is imported

- **Issues**: summary, description, status, priority, labels, assignee, parent (sub-tasks
  and epic children), due date, and the created and updated dates. Descriptions and
  comments are converted from Atlassian Document Format to Markdown. Each description
  ends with `Imported from Jira: OPS-12`.
- **Statuses** become states. Jira's "To Do" category maps to unstarted, "In Progress" to
  started and "Done" to completed; a status named like "Backlog" maps to backlog and one
  named like "Cancelled" or "Won't Do" to canceled.
- **Priorities**: Highest becomes urgent, High high, Medium medium, Low and Lowest low.
  Other priority names are left empty.
- **Sprints** become cycles. An issue gets its latest sprint. A sprint that has not
  started has no dates and is not imported.
- **Issue links**: "Blocks", "Duplicate" and "Relates". Other link types are dropped.
- **Comments**, oldest first. Jira has no reply threading.
- **Assignees and comment authors** are matched to project members by email. Jira hides
  the email of a user whose profile visibility does not allow it; such a user counts as
  unmatched.
- **Attachments**, downloaded and attached to the same issue, within this instance's
  upload limits.
- A link to an issue of the same site (`https://acme.atlassian.net/browse/OPS-7`) becomes
  `OPS-7`, and a mention of `OPS-7` is rewritten to this project's issue when that issue
  was imported too.

## What is not imported

- Custom fields, components, versions, story points, epics as their own entity, work
  logs, watchers, votes and history.
- Images embedded in the text appear only as attachments, not inline.
- A parent issue in another project is named in the description (`Parent in Jira:`) instead
  of linked.

## Other sources

[Plane](importing-from-plane.md), [Linear](importing-from-linear.md),
[Trello](importing-from-trello.md), [Procore](importing-from-procore.md),
[MS Project](importing-from-ms-project.md).
