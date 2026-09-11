# Importing from Plane

Project Settings → Import/Export connects a project to a self-hosted (or cloud) Plane
instance, pulls one Plane project's issues into it, and shows the job's progress while it
runs. This page describes exactly what it brings over, what it does not, and what to expect
while it runs. Read the limitations section before importing anything you care about — some
of them affect data you may not notice is missing until later.

## What you need

- The URL of the Plane instance (e.g. `https://plane.example.com`).
- The workspace slug.
- An API token (workspace or personal) with read access to that workspace's projects,
  issues, and members. The token is stored encrypted and is only ever used by the import
  itself — it is never shown again after you submit it, and it is deleted once the job
  finishes or is canceled.

## Steps

1. Open the project's **Settings → Import/Export**.
2. Enter the Plane URL, workspace slug, and API token, then **Test connection**. This
   checks the token live against Plane and lists that workspace's projects — nothing is
   saved yet at this point.
3. Pick the Plane project to import from, then **Start import**.
4. The job appears in the list below, in the background. You can leave the page and come
   back — it keeps running, and pause, resume, or cancel it from the same list at any time.

## What is imported

- **Issues** — title, description (converted from Plane's rich text to Markdown), state,
  labels, cycle, priority, start date, due date, and the parent issue if it is a sub-issue.
- **Assignees and comment authors** — matched to an existing project member by email. If no
  member has that email, the issue or comment is imported with no assignee — it is never
  assigned to the wrong person, and no placeholder account is created.
- **Comments** — body (converted to Markdown) and reply threading.
- **Labels, workflow states, and cycles** — created if they do not already exist by that
  name.
- **Issue relations** — "blocks", "relates to", and "duplicates" only.

## What is not imported

- **Attachment files.** Attachments are not downloaded — not the file, not even the
  filename. The progress list shows how many attachments Plane reports for the imported
  issues, but that count never moves past "created: 0"; that is expected, not a stuck
  import. If a description or comment mentions an attachment, the mention comes across as
  plain text with nothing behind it.
- **Custom fields**, whatever they are named in the source project.
- **Modules and milestones.**
- **Work item types** (Epic and any custom type) — every imported item becomes a plain
  issue, with no record of what type it was in Plane.
- **Time logs, reactions, watchers, and edit/activity history.**
- **Four of Plane's eight relation kinds** — the scheduling-dependency ones (starts
  before/after, finishes before/after) have no equivalent here and are dropped.
- **Cross-references inside text.** A description or comment that says "see PROJ-123" keeps
  saying that after import — it is not rewritten to point at the new issue here, since the
  link is just text to the importer, not a resolvable reference.

## Mapping is automatic, with no review step

States and users are matched automatically — by name for states (falling back to Plane's
own backlog/unstarted/started/completed category when no name matches), by email for
users — and there is currently no screen to review or correct that mapping before the
import runs. This matters because Plane's own state categories are not always accurate: a
real workspace checked during development had a state named "In Progress" that Plane itself
categorized as "backlog" internally. An import can land some issues in a state that reads
oddly, and the fix today is to move them by hand afterward, not to adjust the mapping before
running the import.

## Sub-issue links can be missed

A sub-issue's link to its parent is set at the moment the sub-issue itself is created,
using whichever of the two happens to already exist in this project by then. Issues are not
necessarily created in an order where every parent comes before its children, so an
occasional sub-issue can land with no parent set. There is no follow-up pass that goes back
and fixes this — unlike issue relations, which do get a second pass. If sub-issue structure
matters to you, check it after the import finishes.

## Rate limits are real, and the import waits them out

Plane limits how many requests it will answer per minute. A project of any real size will
run into that limit, and the job pauses to wait it out — you will see "Plane's rate limit
was reached, retrying in Ns" in the job list when this happens. This is normal, not a
failure; the import resumes on its own once the wait is over. A large project can take a
long time to finish for this reason alone.

## Pausing, resuming, canceling, and running it again

Pausing and resuming continues from where the job left off. Canceling stops it where it
stands — issues already created stay created, nothing is rolled back. Starting a *new*
import against the same Plane project does not know about a previous one and will create a
second copy of everything; there is no way today to update an existing import or skip what
was already brought in from an earlier run against the same source.

## Only Plane, only import

Plane is the only supported source today — Linear and Jira are not available. And despite
the page being named "Import/Export", there is currently no export — this page only brings
data in.
