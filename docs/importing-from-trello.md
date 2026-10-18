# Importing from Trello

Project Settings → Import/Export → **Trello** imports one Trello board into a One Health
project. The phases, pausing, rate limits and re-running behave as described in
[Importing from Plane](importing-from-plane.md); this page covers what is specific to Trello.

## What you need

- A Trello API key: create a Power-Up at trello.com/power-ups/admin and generate the key.
- A token for that key, generated from the same page, for a member who can see the board.
  Read access is enough. Both are stored encrypted, used only by the import, and deleted
  when the job ends.

## Steps

1. Enter the API key and token, then **Test connection**. The boards the member can see are
   listed, closed boards included.
2. Pick the board. Its lists appear as states, with the category each maps to.
3. Change any list that maps wrongly, choose how to handle unmatched people, and
   **Start import**.

## What is imported

- **Lists** become states, archived lists included. Trello lists have no category, so the
  name decides: "Done" or "Complete" maps to completed, "Doing", "In progress" or
  "Review" to started, "Backlog" or "Ideas" to backlog, "Cancelled" to canceled, and any
  other name to unstarted. Check every row in the review step.
- **Cards** become issues, archived cards included: name, description (already Markdown),
  list, labels, start date, due date, the first member as assignee, and the creation date.
  Each description ends with `Imported from Trello: <card URL>`.
- **Checklists** are added to the description as task lists, under a heading per checklist.
- **Link attachments** are listed in the description under "Links".
- **Labels**: a label with no name is named by its colour.
- **Comments**, oldest first.
- **Uploaded attachments**, downloaded and attached to the same issue, within this
  instance's upload limits.

## Members and emails

Trello shows a member's email only to that member. Usually only the member who created the
token has an email, so other members' cards and comments count as unmatched and follow the
policy chosen in the review step.

## What is not imported

- Cycles, priorities, parent issues and issue relations: Trello has none.
- Custom fields, Power-Up data, votes, stickers, card covers and activity other than
  comments.
- Mentions of other cards are left as written; Trello cards have no `KEY-123` identifier to
  rewrite.

## Other sources

[Plane](importing-from-plane.md), [Linear](importing-from-linear.md),
[Jira](importing-from-jira.md).
