# Outcome

Add a project Docs action that previews progress for a configured three-level task hierarchy and saves one weekly report. Users continue to record progress in the existing task form. The preview shows level-one and level-two progress. The saved, copyable Markdown contains level-two progress and reportable delay reasons.

# Scope

Bind the three issue types, the level-two and level-three weight fields, the level-three completion-rate field, and the level-two and level-three delay reason fields by project-local ID. Reuse built-in due dates and status categories. Read the detailed rules in [the target spec](specs/weekly-project-report/spec.md).

Use the existing local checkout at `/Users/poco/Projects/itsaplan` and branch `codex/weighted-weekly-report` from tag `v1.11.0`. Use fictional tasks and accounts on separate loopback ports and in a separate test database and storage namespace. Keep the running trial instance, its configuration and its data intact. Local delivery only.

## Directory structure

### Created

- `apps/api/src/modules/weekly-reports/` for configuration validation, preview, saving and tests.
- `apps/api/weekly-report-migrations/` for the build-specific weekly report index and journal.
- `apps/web/src/lib/api/endpoints/` and `apps/web/src/services/` for report requests and mutations.
- `apps/web/src/features/settings/components/` and `apps/web/src/features/documents/components/` for project settings and the preview dialog.

### Modified

- `apps/api/src/planner.ts` and `apps/api/src/app.ts` to register the routes and API tag.
- `apps/api/src/modules/documents/service.ts` to reuse Docs creation in the snapshot transaction.
- `apps/api/src/modules/projects/copy.ts` to leave report bindings unset in a project copy.
- Project settings, Docs and translation files to expose the controls and results.

## Source coverage

The supplied conversation is `已粘贴的文本.txt`. Coverage includes the minimum implementation proposal at lines 730–746, the original examples and constraints that define that proposal, and the latest user messages. Earlier installation transcripts, legal discussion, and trial command logs describe the evaluation and are outside the implementation scope. File references in the proposal identify code in the local v1.11.0 checkout.

| Source and location | Read state | Content to retain | Spec location | Acceptance | Coverage | Reason |
| --- | --- | --- | --- | --- | --- | --- |
| S1. Attachment lines 3–7, 13, 762–764 | complete | Official Community v1.11.0 baseline, local-only fake data, existing trial instance, verified local entry point. | Local validation | A7 | covered | Applicable environment and verification constraints. |
| S2. Attachment lines 8–9, 442–447, 516 | complete | Three levels entered in native task detail, child creation while a parent is in progress, original due date, type-specific weight and rate fields and persisted `80` example. Retain native form fields. | Project configuration and progress | A1, A2 | covered | Reuse the evaluated workflow and retain its behavior. |
| S3. Attachment lines 10, 446–447, 517, 736, 740 | complete | Compute `40% × 80% + 60% × 100% = 92%`, then roll up using the level-two weights. Read the actual level-three rate. Validate weights and retain archived completed work. Internal preview shows both levels and Docs shows level two. Native task counts stay intact. | Project configuration and progress | A2, A3 | covered | Core computation and display. |
| S4. Attachment lines 11, 449, 518, 737, 746 | complete | Optional reportable reason fields, project-local due-date rule, completed and canceled exclusion, self and direct-parent grouping, child overdue before parent, missing-reason prompt, and confirmation after review. | Delays | A4 | covered | Core reporting behavior and ordinary task updates. |
| S5. Attachment lines 11, 448–449, 519, 730, 738, 746 | complete | Manual Docs entry and preview, dated Markdown and copy, lock and history through Docs, one project/week transaction, new week makes a new doc, default sharing off, level-two-only text. | Weekly snapshots | A5, A6 | covered | Core weekly reporting and access rules. |
| S6. Attachment line 744 | complete | One feature module and project settings entry, ID binding, rebind copies, separate migration, and regression coverage of documents and archived work. | Project configuration and progress, Weekly snapshots | A1, A3, A5, A6 | covered | The maintenance constraints of the chosen design. |
| S7. Attachment lines 3, 11, 625, 746 | complete | Earlier evaluation and proposal were read-only. | — | — | superseded | The implementation request authorizes local feature changes from the tagged baseline. |
| S8. Attachment lines 3, 746 and latest user messages | complete | No paid feature, new integrations or real data. Scheduled reporting is a future option. Retain this checkout, use a local development branch, leave the trial running and keep changes local. | Local validation | A7 | covered | Current delivery boundary. |

# Non-goals

- Scheduled generation, redesign of the task form, and changes to native subtask counters.
- Data import, external integrations, Pro changes, and remote publication.

# Decisions

- Use Monday as the first day of the week, as in the trial examples. Set the report time zone per project, with `Asia/Taipei` for the local fixture.
- Display unavailable progress with an explanation and omit a percentage for that value. Missing reportable reasons prompt the reviewer and stay optional. The reviewer can return to the task form or confirm the report with the available information.
- Save a locked document visible under the project's standard Docs permissions. Use the existing Docs unlock, copy and history actions. The feature creates no public token and leaves explicit sharing to the existing Docs access controls.

# Acceptance examples

1. A project administrator can bind valid issue types, compatible custom fields and an IANA time zone in project settings. Invalid or cross-project ID bindings are rejected, and project copies require rebinding. Native task forms still support the existing hierarchy and fields.
2. In the internal preview, level-three weights `40/60` and rates `80/100` give `92%`. A level-one node with level-two weights `60/40` and rates `92/50` shows `75.2%`. The native counter still displays completed child counts.
3. Missing or out-of-range values, sibling weights that fail to total `100%`, and absent children yield an unavailable calculation rather than a fabricated percentage. An unavailable contributing level-two result carries through to level one. A completed archived child still contributes its reported rate and weight.
4. With fictional tasks, earlier due dates trigger delay reporting in the configured time zone. Group an overdue level-two task's own reason and a direct level-three child's reason under level two, including children due before their parent. The day a task is due, unscheduled work, completed tasks and canceled tasks produce no delay line. A blank reason prompts review. Ordinary task updates can still save without a reason.
5. From Docs, preview both progress levels internally and confirm a dated, locked, copyable Markdown document with only level-two titles, progress and reportable reasons. The document contains no generated level-three title, key or link. Enforce existing source task and Docs permissions on the routes. No public share token is generated.
6. Concurrent and repeated saves within the same project/week resolve to one document without overwriting its content. A new week creates its own document and reflects changes since the prior week. Run the feature migration separately from the core journal and verify its unique key and document transaction.
7. Verify the feature with fictional data on a local, isolated test instance while the v1.11.0 trial remains available on its existing ports and database. The sole checkout is the current project directory and the development branch is based on the v1.11.0 tag. Keep all changes local.
