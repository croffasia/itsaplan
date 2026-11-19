# Weekly project report

## Project configuration and progress

Project settings use the existing per-project store. An editor with workflow configuration permission chooses three distinct project issue types, numeric level-two and level-three weight fields, a numeric level-three reported completion-rate field, optional-text reason fields for levels two and three, and a valid IANA project reporting time zone. Each binding must belong to the project and be available for the corresponding issue type. An unconfigured project gets a setup indication. Copying a project preserves its normal fields and types and leaves the report bindings unset for the new IDs.

The report follows direct parent links between the configured types, from a root level-one issue to its level-two issues and then to their level-three issues. Existing task forms, field values, built-in due dates and direct-child completion counters continue to work. The calculation uses only reportable hierarchy members and excludes canceled members. Archived completed tasks remain in the hierarchy and count in the calculation.

For each level-two node, add each participating level-three issue's reported completion rate multiplied by its weight divided by 100. For each level-one node, repeat using its level-two children's computed rates and weights. Weights and reported rates must be present and between 0 and 100 inclusive. Sibling weights must total 100 at their stored precision. Do not round intermediate results. A group without contributing children, a missing or invalid value, a weight total other than 100, or an unavailable contributing child yields unavailable progress. Identify affected inputs in the internal preview. Show unavailable progress without a numeric substitute in the preview or saved report.

## Delays

Use the generation date in the configured project time zone. A level-two or level-three issue is overdue if its due date is earlier than this date and its status category is neither completed nor canceled. Due-today issues and issues without a due date do not qualify. Delay eligibility uses status, and the progress calculation uses the reported numeric rate.

Group a level-two issue's own reason with qualifying reasons from its directly attached level-three issues under that level-two issue. Include a child's delay when its parent is not overdue. Exclude completed and canceled issues' reasons from newly generated content. Omit blank reasons from the Markdown and identify the corresponding tasks in the internal preview. The source fields stay optional for ordinary work. A report creator can review the warnings before confirming the snapshot.

## Weekly snapshots

Add a manual action to project Docs. An authorized user sees level-one and level-two calculated progress and the relevant warnings before confirming. A reader may open an existing report under ordinary Docs access rules. Reading source task data and creating a snapshot require the existing task-read and Docs permissions. The settings mutation uses the existing workflow configuration permission.

Save a dated, locked Docs document containing Markdown for each level-two node's title, displayed progress and explicitly reportable reasons. Generate no level-three titles, keys, links, rows or document references. Use existing Docs rendering, copying and history. Public sharing starts disabled. Treat report text from issue fields as text when formatting Markdown.

Use the Monday of the generation week in the configured zone as the week start. Enforce uniqueness on project ID and week start in a dedicated build migration, with a link to the native document. Write the link and the document atomically. A repeated or concurrent confirmation returns the existing document. A later week makes a new document without modifying earlier ones. Handle a manual Docs deletion through normal document lifecycle semantics without leaving a stale reference.

## Local validation

Implement in the current checkout on a local branch at Community tag `v1.11.0` (`deb35f7`). Use a test-only database and storage, separate from the trial, and loopback-only service ports. Validate native form reuse, the `92%` and `75.2%` calculations, archived work, delayed and completed items, missing input, access checks, concurrent confirmation, and two independent weeks using fictional data. Verify that the trial remains available and keep the work local.
