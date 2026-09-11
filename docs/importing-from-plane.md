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
- **Cross-references inside text, when both sides were imported.** A description or
  comment that says "see ROOMS-524" is rewritten to point at this project's own
  identifier for that issue, once it has been imported too. A mention of an issue
  outside the imported set is left exactly as Plane wrote it.

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

## Mapping is automatic, with no review step

States and users are matched automatically — by name for states (falling back to Plane's
own backlog/unstarted/started/completed category when no name matches), by email for
users — and there is currently no screen to review or correct that mapping before the
import runs. This matters because Plane's own state categories are not always accurate: a
real workspace checked during development had a state named "In Progress" that Plane itself
categorized as "backlog" internally. An import can land some issues in a state that reads
oddly, and the fix today is to move them by hand afterward, not to adjust the mapping before
running the import.

## Rate limits are real, and the import waits them out

Plane limits how many requests it will answer per minute. A project of any real size will
run into that limit, and the job pauses to wait it out — you will see "Plane's rate limit
was reached, retrying in Ns" in the job list when this happens. This is normal, not a
failure; the import resumes on its own once the wait is over. A large project can take a
long time to finish for this reason alone.

## Pausing, resuming, canceling, and running it again

Pausing and resuming continues from where the job left off. Canceling stops it where it
stands — issues already created stay created, nothing is rolled back.

Starting a *new* import against the same Plane project (after a cancel, or any other time)
reuses what a previous run already created instead of duplicating it: a state, cycle, or
issue is matched by name (issue titles case- and whitespace-insensitively) against what is
already in the project, and a comment is matched by its exact body and timestamp on the
matched issue. Labels always dedupe this way too. Nothing about an existing match is
overwritten — an existing state's category, for instance, is left as it is even if Plane
categorizes it differently.

This is a name/content match, not a record of which import created what, so it also means
an issue you created by hand before importing — one that happens to share an exact title
with something in Plane — is treated as the same issue and gets Plane's labels, comments,
and other fields attached to it rather than getting a second copy.

## Only Plane, only import

Plane is the only supported source today — Linear and Jira are not available. And despite
the page being named "Import/Export", there is currently no export — this page only brings
data in.
