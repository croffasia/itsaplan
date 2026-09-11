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
3. Pick the Plane project to import from. Its states appear for review (see below), with a
   choice for how to handle an unmatched assignee or comment author.
4. **Start import.** The job appears in the list below, in the background. You can leave the
   page and come back — it keeps running, and pause, resume, or cancel it from the same list
   at any time.

## What is imported

- **Issues** — title, description (converted from Plane's rich text to Markdown), state,
  labels, cycle, priority, start date, due date, and the parent issue if it is a sub-issue.
- **Assignees and comment authors** — matched to an existing project member by email. It is
  never assigned to the wrong person, and no placeholder account is created; what happens
  when no member has that email is a choice you make in the mapping review step below.
- **Comments** — body (converted to Markdown) and reply threading.
- **Labels, workflow states, and cycles** — created if they do not already exist by that
  name.
- **Issue relations** — "blocks", "relates to", and "duplicates" only.
- **Cross-references inside text, when both sides were imported.** A description or
  comment that says "see ROOMS-524" is rewritten to point at this project's own
  identifier for that issue, once it has been imported too. A mention of an issue
  outside the imported set is left exactly as Plane wrote it.
- **Attachment files**, downloaded and attached to the same issue they were on in Plane.
  A file is skipped, not imported, when it is larger than this instance's own upload
  limit or of a file type this instance doesn't accept — the same limits an ordinary
  attachment upload on this instance is held to. A skipped file is only noted in the
  server log, not shown anywhere in this screen today. Re-running an import reuses a
  file already attached with the same name on the same issue, rather than attaching it
  a second time.

## What is not imported

- **A mention of an attachment inside a description or comment's own text** (an image
  pasted directly into the rich text, not listed as a separate attached file) comes
  across as plain text with nothing behind it — only attachments listed as their own
  files are downloaded.
- **Custom fields**, whatever they are named in the source project.
- **Modules and milestones.**
- **Work item types** (Epic and any custom type) — every imported item becomes a plain
  issue, with no record of what type it was in Plane.
- **Time logs, reactions, watchers, and edit/activity history.**
- **Four of Plane's eight relation kinds** — the scheduling-dependency ones (starts
  before/after, finishes before/after) have no equivalent here and are dropped.

## Reviewing the mapping before you import

After you pick the source project, its states are shown with the category itsaplan would
automatically map each one to (matched by name, falling back to Plane's own backlog/
unstarted/started/completed group when no name matches). This matters because Plane's own
state categories are not always accurate: a real workspace checked during development had a
state named "Cancled" (misspelled) that Plane itself grouped as "completed" internally, not
"canceled". Change any row that reads wrong before starting the import — a state you don't
change keeps the automatic mapping.

The same screen has one more choice: what happens to an assignee or comment author whose
email matches no member of this project. "Leave unassigned" (the default) imports the issue
or comment anyway, with that field empty. "Skip the assignment or comment" leaves an issue's
assignee empty the same way, but drops a comment entirely rather than importing it with no
attributed author.

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

## Exporting your project's data

The **Export** section at the bottom of the page downloads a JSON file with the project's
states, labels, cycles, and issues (with their comments and relations) — a self-contained
snapshot, readable on its own, using this project's own identifiers rather than database
ids. This is a download, not a live sync: it does not write anywhere, including back into
Plane, and nothing is scheduled or kept running.

## Only Plane, only import

Plane is the only supported source to import from today — Linear and Jira are not
available.
