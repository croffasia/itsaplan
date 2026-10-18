# The MS Project import source

How the MS Project source plugs into the pipeline in [plane-import.md](plane-import.md). The
user guide is [importing-from-ms-project.md](../importing-from-ms-project.md).

## Shape

- `apps/api/src/modules/import-export/msproject.ts` — the upload, validation and job fields.
- `apps/worker/src/msproject-mapping.ts` — MSPDI parsing and the mapping.
- `apps/worker/src/msproject-adapter.ts` — `MsProjectReader`, which serves the pipeline from
  the parsed file.
- `apps/worker/src/import-sources.ts` — the `msproject` entry: config
  `{ msprojectFileKey, msprojectName }`, no Rewrite prefix.

## Upload

`POST /projects/:projectKey/import-jobs/msproject-upload` takes a multipart `file`:

1. A name ending `.mpp` is refused with "Save the plan as XML first". Any other name must end
   `.xml`. The size limit is 20 MB (413).
2. The text must contain no `<!DOCTYPE` or `<!ENTITY`, must parse as XML, and its root must be
   `<Project xmlns="http://schemas.microsoft.com/project">`. A plan with no importable task is
   refused.
3. The file is stored with `putObject` under `import-sources/{projectId}/{uuid}.xml`.
4. The response is `{ fileKey, fileName, taskCount, states }`. It is the preview: the three
   states and the task count; there is no separate preview request.

Creating a job (`source: 'msproject'`) takes `msprojectFileKey` and `msprojectName`. The key must
start with `import-sources/{projectId}/` of the project the job is created in, end with `.xml`
and contain no `..`, so a job cannot read another project's or another feature's object.

## Credential

The pipeline requires an encrypted credential. An MS Project job stores `{}`; nothing reads it.

## File lifetime

`completeImportJob` and `failImportJob` in `apps/worker/src/import-store.ts` delete the object
named by `config.msprojectFileKey` after clearing the credential. The api deletes it when a job
is canceled. A failed delete is logged and does not change the job. A file that was uploaded and
never used by a job is not deleted.

## Parsing

`fast-xml-parser` (a dependency of `apps/worker` and `apps/api`) with `ignoreAttributes: true`
in the worker, `removeNSPrefix: true`, `parseTagValue: false` and `htmlEntities: false`. A
document with a DOCTYPE or an ENTITY declaration is refused before parsing, so entities cannot
be declared or expanded; the five predefined XML entities and numeric character references are
decoded. The reader parses the file once per tick and serves every call from memory.

## Mapping

`parseMspdi` keeps each `Task` whose `UID` is not `0` and whose `Name` is not empty.

| MSPDI | Canonical |
|---|---|
| `UID` | `sourceId` |
| `ID` | `sequenceId` |
| `Name` | `title` |
| `Notes` | `descriptionMarkdown` |
| `PercentComplete` | state `todo` (0), `in-progress` (1-99), `done` (100+) |
| `Start`, `Finish` | `startDate`, `dueDate`: the first 10 characters |
| `OutlineLevel` | `parentSourceId`: the nearest preceding kept task with a lower level |
| `PredecessorLink/PredecessorUID` | `blocks` relation, predecessor to successor; unknown or self links are dropped |
| `Assignment` + `Resource/EmailAddress` | `assigneeEmail`: the first assignment of the task whose resource has an email |
| `Priority` | 0-299 low, 300-699 medium, 700-899 high, 900+ urgent |
| `Milestone` | label `milestone` ("Milestone"), listed only when a milestone exists |
| `CreateDate` | `createdAt` and `updatedAt`, else the project's `CreationDate` or `LastSaved`, else the time of the import |

Paging: the cursor is the offset into the task list, 100 tasks per page.
Comments, attachments and cycles are empty.

## Sources

- MSPDI schema namespace: https://learn.microsoft.com/en-us/office-project/xml-data-interchange/project-xml-data-interchange-schema-reference
