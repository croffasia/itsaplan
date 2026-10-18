# Importing from MS Project

Project Settings → Import/Export → **MS Project** imports the tasks of a Microsoft Project plan
into a One Health project. The phases, pausing and re-running behave as described in
[Importing from Plane](importing-from-plane.md); this page covers what is specific to MS
Project. The plan is uploaded as a file, so no account or credential is involved.

## Save the plan as XML first

The import reads the XML format of MS Project (MSPDI), not the binary `.mpp` format. In MS
Project choose **File → Save As**, set **Save as type** to **XML Format**, and save. Upload the
`.xml` file. A `.mpp` file is refused with this instruction. The file can be up to 20 MB.

## Steps

1. Choose the `.xml` file. One Health checks that it is an MS Project XML file and shows the
   file name and the number of tasks it will import.
2. Check the three states ("Todo", "In Progress", "Done") and their categories, choose how to
   handle unmatched people, and **Start import**.

The uploaded file is deleted when the job completes, fails or is canceled.

## What is imported

Each named task becomes an issue. The project summary task (the top row of the plan) is not
imported, and neither are rows with an empty name.

| MS Project | One Health |
|---|---|
| Task name | title |
| Notes | description |
| % Complete | state: 0 is "Todo", 1 to 99 is "In Progress", 100 is "Done" |
| Start, Finish | start date, due date (dates only) |
| Outline level | parent issue: a summary task becomes the parent of the tasks indented under it |
| Predecessors | relations: a predecessor blocks its successor, whatever the link type |
| Resource assigned to the task | assignee, when the resource has an email address; the first such resource is used |
| Priority (0 to 1000) | 0 to 299 low, 300 to 699 medium, 700 to 899 high, 900 and above urgent |
| Milestone | the label "Milestone" |
| Task ID | the issue number used to find the task in the plan |

## What is not imported

- Comments and attachments: plans have none.
- Resource hours, costs, baselines, calendars, constraints, custom fields and the Gantt layout.
- Links to tasks of other plans.
- Tasks with no name.

## Other sources

[Plane](importing-from-plane.md), [Linear](importing-from-linear.md),
[Jira](importing-from-jira.md), [Trello](importing-from-trello.md),
[Procore](importing-from-procore.md).
