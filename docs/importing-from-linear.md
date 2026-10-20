# Importing from Linear

Project Settings → Import/Export connects a project to a Linear workspace with a personal API
key, pulls one Linear team's project (or that team's issues that belong to no project) into
it, and shows the job's progress while it runs. This page describes exactly what it brings
over, what it does not, and what to expect while it runs. Read the limitations before
importing anything you care about — some of them affect data you may not notice is missing
until later.

## What you need

- A Linear personal API key. In Linear, open Settings → Security & access → Personal API
  keys and create one; read-only access is enough. The key is stored encrypted and is only
  ever used by the import itself — it is never shown again after you submit it, and it is
  deleted once the job finishes or is canceled.
- The people whose assignments and comments should keep their names must already be members
  of this project, with the same email address they use in Linear.

## Steps

1. Open the project's **Settings → Import/Export** and choose **Linear** under Source.
2. Paste the API key, then **Test connection**. This checks the key live against Linear and
   lists the teams it can see, each with its projects — nothing is saved yet at this point.
3. Pick the team, then one of its projects or **Issues with no project**. The team's workflow
   states appear for review (see below), with a choice for how to handle an unmatched
   assignee or comment author.
4. **Start import.** The job appears in the list below, in the background. You can leave the
   page and come back — it keeps running, and you can pause, resume, or cancel it from the
   same list at any time.

One job imports one project of one team. To bring a whole team over, run one job per Linear
project, plus one for the team's issues with no project.

## What is imported

- **Issues** — every issue in the project you picked, including completed, canceled, and
  archived ones: title, description (Linear already stores Markdown, so it is kept as
  written), state, labels, cycle, priority, due date, the parent issue if it is a sub-issue
  in the same import, and the dates the issue was created and last updated in Linear. If
  this project archives completed or canceled issues automatically, an imported issue whose
  last update in Linear is older than that threshold is archived on the next sweep.
- **The Linear identifier.** Every imported issue's description ends with a line such as
  `Imported from Linear: ATO-505`, so you can still find an issue by its Linear identifier.
  That line is never rewritten to this project's identifier.
- **A sub-issue whose parent is not part of the same import** (it is in another project or
  another team) cannot keep its parent link. Its description gets a line such as
  `Parent in Linear: ATO-12` just above the identifier line instead.
- **Priority** — Urgent, High, Medium, and Low keep their level; No priority stays empty.
- **Assignees and comment authors** — matched to an existing project member by email. It is
  never assigned to the wrong person, and no placeholder account is created; what happens
  when no member has that email is a choice you make in the mapping review step below.
- **Comments** — body, reply threading, original author, and original date. A comment
  posted by an integration (GitHub, Slack, and so on) keeps the integration's name as its
  author.
- **Labels** — created if they do not already exist by that name, with their Linear color.
  A label inside a label group is named after its group, for example `kind/bug`. Every label
  of the team and every workspace-wide label is created, whether or not an imported issue
  uses it.
- **Workflow states** — created if they do not already exist by that name. Linear's Triage
  states map to Backlog and its Duplicate states to Canceled; you can change either in the
  mapping review.
- **Cycles** — with their start and end dates. A cycle with no name is named after its
  number, for example `Cycle 3`. Two cycles with the same name are kept apart: the repeated
  name becomes `<name> (Cycle <number>)`. Every cycle of the team is created, whether or not an
  imported issue belongs to it.
- **Issue relations** — "blocks", "related", and "duplicate", each once and in its original
  direction, when both issues are part of the same import.
- **Links attached to an issue** (a GitHub pull request, a URL, including archived link
  attachments) — listed at the end of the description under a **Links** heading.
- **Files uploaded into a description or a comment** — downloaded with your API key and
  attached to the same issue. The link in the text stays as Linear wrote it. Several files
  with the same name on one issue (three screenshots all called `image.png`) are kept apart
  as `image.png`, `image (2).png`, `image (3).png`; the suffix is never one that another file
  on that issue already uses. A link to an upload that sits right before a full stop, comma,
  or other sentence punctuation is still found. A file is skipped, not imported, when it
  is larger than this instance's own upload limit, when its type is one this instance does
  not accept, or when Linear's file storage answers the download with an error. The type is
  read from the file's name, so a file whose name has no extension counts as a generic
  binary file, which the default settings do not accept. A skipped file is only noted in the
  server log, not shown anywhere in this screen today. Re-running an import reuses a file
  already attached with the same name on the same issue, rather than attaching it a second
  time.
- **Mentions of other issues.** A link to a Linear issue inside a description or comment is
  turned into that issue's identifier, such as `ATO-12`. An identifier that directly follows
  a `/`, as in the path of a URL, is not changed. When that issue was imported by the
  same job, the identifier is then rewritten to this project's own identifier for it. When it
  was not, `ATO-12` stays as it is, and searching for it finds the issue wherever it was
  imported, by its `Imported from Linear` line.

## What is not imported

- **Estimates, SLAs, reactions, subscribers (watchers), and activity history.**
- **Completed and canceled times.** An issue keeps its state, which places it in the right
  column, but not the time it was completed or canceled.
- **Project milestones, project updates, documents, initiatives, and custom views.** A Linear
  project's own name, description, and status are not copied either — only its issues.
- **Archived state.** An archived Linear issue is imported as an ordinary issue in its state.
- **Deleted issues** — an issue in Linear's trash is left out.
- **Start dates** — Linear issues have none.
- **"Similar" relations** — Linear suggests these itself; nobody created them.
- **Files outside Linear's own file storage.** A link attachment pointing anywhere else is
  listed under Links, not downloaded.

## Limits on labels and links

An issue can have at most 50 labels and at most 50 link attachments. When an issue has more,
the import stops with an error that names the issue and says it is stopping to avoid a
truncated import, instead of importing the issue without the rest.

## Reviewing the mapping before you import

After you pick the team and project, the team's workflow states are shown with the category
itsaplan would automatically map each one to: Linear's own Backlog, Unstarted, Started,
Completed, and Canceled types map to the same categories, Triage to Backlog, and Duplicate to
Canceled. Change any row that reads wrong before starting the import — a state you don't
change keeps the automatic mapping.

The same screen has one more choice: what happens to an assignee or comment author whose
email matches no member of this project. "Leave unassigned" (the default) imports the issue
or comment anyway, with that field empty. "Skip the assignment or comment" leaves an issue's
assignee empty the same way, but drops a comment entirely rather than importing it with no
attributed author. A comment from an integration has no email to match, so it is always
imported under the integration's name.

## Rate limits are real, and the import waits them out

Linear allows each API key a fixed number of requests, and of query complexity, per hour. A
project of any real size can reach that limit, and the job pauses to wait it out — you will
see "The source's rate limit was reached. Retrying in Ns." in the job list when this happens.
This is normal, not a failure; the import resumes on its own once Linear's limit resets,
which can take up to an hour. A large project can take a long time to finish for this reason
alone.

## Pausing, resuming, canceling, and running it again

Pausing and resuming continues from where the job left off. Canceling stops it where it
stands — issues already created stay created, nothing is rolled back.

Starting a *new* import of the same Linear project reuses what a previous run already
created instead of duplicating it: a state, cycle, or issue is matched by name (issue titles
case- and whitespace-insensitively) against what is already in the project, and a comment is
matched by its exact body and timestamp on the matched issue. Labels always dedupe this way
too. Nothing about an existing match is overwritten.

This is a name/content match, not a record of which import created what, so an issue you
created by hand before importing, with exactly the title of an issue in Linear, is treated as
the same issue and gets Linear's labels, comments, and other fields attached to it rather
than getting a second copy. Within one import, two different Linear issues with the same
title stay two issues, and two comments with the same text and time stay two comments.

## Other sources

[Importing from Plane](importing-from-plane.md) describes the Plane source. Jira and Trello
are not available.
