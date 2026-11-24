# Importing from Trello

Project Settings → Import/Export connects a project to Trello with an API key and a token,
imports one Trello board into the project, and shows the job's progress while it runs. This
page describes what the import brings over, what it does not, and what to expect while it
runs.

## What you need

- A Trello API key. Trello gives API keys to Power-Ups: open the
  [Power-Up admin page](https://trello.com/power-ups/admin), create a Power-Up (any name and
  workspace), open its **API key** tab and generate a key.
- On the same tab, add the address of this instance (the form shows it, for example
  `https://plan.example.com`) to **Allowed origins**. Trello sends the token only to an
  allowed address; without it the authorization window shows an error.
- The key and the token are stored encrypted in the import job only, because the job runs in
  the background. They are deleted when the job finishes or is canceled.

## Steps

1. Open the project's **Settings → Import/Export** and choose **Trello** under Source.
2. Enter the API key and click **Authorize in Trello**. Trello opens in a small window: allow
   read access there. The window closes, and the boards you can see are listed, open boards
   first. Nothing is saved at this point. The token is valid for 30 days.
3. Pick a board. Its open lists appear for review (see below), with two more choices: what to
   do with archived cards, and whether to match the board's members with project members.
4. **Start import.** The job appears in the list below and runs in the background. You can
   leave the page and come back. You can pause, resume or cancel the job from the same list.

One job imports one board.

## What is imported

- **Cards** become issues: title, description (Trello stores Markdown, so it is kept as
  written), list, labels, start date, due date, and the dates the card was created and last
  changed. Each column keeps the order of its Trello list.
- **The Trello link.** The description of every imported issue ends with a line such as
  `Imported from Trello: https://trello.com/c/AbCd1234`, so you can still find the card.
- **Lists** become columns, if a column with that name does not already exist. Only open lists
  become columns.
- **Archived cards.** You choose before the import starts: import them as archived issues, or
  do not import them. The same choice applies to the cards of an archived list. Such a card
  goes to the first column of the project, because its list does not become a column.
- **Labels** — created if they do not already exist by that name, with their Trello color. A
  label with no name is named after its color, for example `Green`. Every label of the board is
  created, whether or not an imported card uses it.
- **Members** — see "Matching members" below.
- **Checklists** — with their items, the order of both, and which items are done.
- **Custom fields** — text, number, checkbox, date and dropdown fields, with the values of each
  card. A date field becomes a date-and-time field and a dropdown field becomes a select field
  with the same options. A project field with the same name and the same type is used instead
  of a new one, and a select field gets the options it does not have yet. A value that an issue
  already holds is not changed. Every custom field of the board is created, whether or not an
  imported card has a value in it.
- **Comments** — body, author name and date. A comment is attributed to a project member when
  its author was matched with one.
- **Links attached to a card** (a URL, a link to another card) are listed at the end of the
  description under a **Links** heading.
- **Links to other cards of the same board** that are attached to a card also become "related"
  links between the two issues.
- **Files uploaded to a card** are downloaded with your key and token and attached to the same
  issue. Several files with the same name on one card are kept apart as `image.png`,
  `image (2).png` and so on. A file is skipped when it is larger than this instance's upload
  limit, when its type is one this instance does not accept, or when Trello answers the
  download with an error. A skipped file is noted in the server log only.

## Matching members

Trello does not give out the email addresses of a board's members, so the import cannot match
them with project members by itself. Before the import starts you choose one of two options:

- **Don't match** — no issue gets an assignee, and every comment shows its Trello author's name.
- **Match by hand** — the board's members are listed, and for each one you can pick a member of
  this project or leave it not matched. The first matched member of a card becomes the issue's
  assignee, and the other matched members watch the issue. A comment by a matched member is
  attributed to that project member.

## What is not imported

- **Card covers, stickers, votes, comment reactions, and the activity history** other than
  comments.
- **The "due date complete" mark.** The issue keeps the due date only.
- **Due dates and assignees of checklist items.**
- **Custom fields of other Power-Ups**, and custom field types other than the five above.
- **Butler automations, board backgrounds, and the board's own settings.**
- **Mentions of other cards in text.** A Trello card link inside a description or a comment
  stays a link to Trello.
- **Images shown inside a description.** The file is imported as an attachment, but the image
  link in the text still points to Trello, which needs a Trello login to open it.

## Reviewing the mapping before you import

After you pick a board, its open lists are shown with the category each one would get. The
category comes from the list's name: "Done" or "Completed" gives Completed, "Doing", "In
progress" or "Review" gives Started, "Backlog" or "Ideas" gives Backlog, and every other list
gives Unstarted. Change any row that is wrong before you start the import. A list you do not
change keeps the automatic category.

## Rate limits

Trello allows each token 100 requests every 10 seconds. When the import reaches that limit, it
waits 10 seconds and continues. The job list then shows "The source's rate limit was reached.
Retrying in Ns." This is normal, not a failure.

## Pausing, resuming, canceling, and running it again

Pausing and resuming continues from where the job stopped. Canceling stops it where it is:
issues that were already created stay, and nothing is rolled back.

A new import of the same board uses what an earlier run created instead of making copies: a
column is matched by name, an issue by title (not case-sensitive), a comment by its exact text
and time, and a checklist by its title on the matched issue. Nothing about an existing match is
overwritten. Because this is a match by name and content, an issue you created by hand with
exactly the title of a card is treated as the same issue.

## Other sources

[Importing from Plane](importing-from-plane.md) and
[Importing from Linear](importing-from-linear.md) describe the other sources.
