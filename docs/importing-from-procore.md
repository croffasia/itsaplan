# Importing from Procore

Project Settings → Import/Export → **Procore** imports the items of one Procore tool, from one
Procore project, into a One Health project. The phases, pausing, rate limits and re-running
behave as described in [Importing from Plane](importing-from-plane.md); this page covers what
is specific to Procore. Each import covers one project and one tool: **Punch list items** or
**RFIs**. Run another import for the other tool.

## What you need

A Developer Managed Service Account (DMSA) of a Procore app, with its client ID and client
secret, and the numeric ID of the Procore company. The credentials are stored encrypted, used
only by the import, and deleted when the job ends.

### Create the service account

1. In the Procore Developer Portal, create an app, or open an existing one of your company.
2. Add an OAuth component with the grant type **Client credentials** to the app manifest.
3. In the Permissions Builder, give the app **read-only** access to the **Punch List** tool and,
   for RFIs, the **RFIs** tool. Nothing else is needed.
4. Publish a version of the app and note the client ID and client secret of its sandbox or
   production credentials.
5. A Procore company administrator installs the app in the company. During the installation the
   administrator approves the permissions and chooses which projects the service account can
   reach. Only those projects appear in One Health.

The company ID is the number in the company's Procore URL. Tick **Use the Procore sandbox** to
connect to `sandbox.procore.com` instead of production.

## Steps

1. Enter the client ID, client secret and company ID, then **Test connection**. The projects the
   service account can read are listed.
2. Pick the project and the tool.
3. Check how the tool's statuses map to states, change any that map wrongly, choose how to
   handle unmatched people, and **Start import**.

## What is imported

Punch list items and RFIs become issues.

| Procore | One Health |
|---|---|
| Punch item name, RFI subject | title |
| Punch item description, RFI description and question | description (HTML reduced to text), ending with `Imported from Procore: …` |
| Status | state |
| First assignment (punch item) or first assignee (RFI) with a login email | assignee |
| Due date | due date |
| Priority (Low, Medium, High, Urgent or Critical) | priority |
| Created and updated times | created and updated times |
| RFI answers, oldest first | comments |
| Attachments | attachments, downloaded within this instance's upload limits |

Statuses map as follows. Procore lets companies rename statuses, and a status that is not in
these tables lands in the project's first state.

- Punch list: Draft is backlog; Initiated, Open and Work Required are unstarted; In Progress,
  Ready for Review, Work Not Accepted and Ready to Close are started; Closed is completed.
- RFIs: Draft is backlog; Open is started; Closed is completed; Void is canceled.

## What is not imported

- Other Procore tools (drawings, submittals, observations, and so on).
- Locations, trades, responsible contractors, distribution lists, and the history of changes.
- Cycles, labels, parent issues and relations.
- Mentions of other items are left as written; Procore items have no `KEY-123` identifier to
  rewrite.

## Rate limits

Procore limits requests per hour. When the limit is reached the job waits for the time Procore
reports and continues; it does not count as a failure.

## Other sources

[Plane](importing-from-plane.md), [Linear](importing-from-linear.md),
[Jira](importing-from-jira.md), [Trello](importing-from-trello.md),
[MS Project](importing-from-ms-project.md).
