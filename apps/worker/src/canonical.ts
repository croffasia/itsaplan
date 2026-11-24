// The canonical intermediate shape a source adapter (SourceReader, see reader.ts)
// produces. Plain types only, no runtime logic. import-worker.ts converts these
// into itsaplan's own tables; nothing here depends on @repo/db so a future
// Linear or Jira adapter can produce the same shape without pulling in the
// worker's persistence layer.

// itsaplan's own project_column.state_type values (packages/db/src/schema/app.ts).
export type CanonicalStateCategory = 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled';

export interface CanonicalState {
  sourceId: string;
  name: string;
  category: CanonicalStateCategory;
}

export interface CanonicalLabel {
  sourceId: string;
  name: string;
  color?: string;
  // The label group it belongs to, made by name when the project lacks it.
  group?: string;
}

export interface CanonicalIssueType {
  sourceId: string;
  name: string;
}

export interface CanonicalCycle {
  sourceId: string;
  name: string;
  // Date-only ('YYYY-MM-DD'): itsaplan's cycle.startDate/endDate carry no time of day.
  startDate: string;
  endDate: string;
  goal?: string;
}

// itsaplan's own custom_field.field_type values that an import creates.
export type CanonicalCustomFieldType =
  | 'text'
  | 'markdown'
  | 'url'
  | 'number'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'select'
  | 'multi_select'
  | 'member';

export interface CanonicalCustomField {
  sourceId: string;
  name: string;
  fieldType: CanonicalCustomFieldType;
  // The option values of a 'select' field, in the source's order.
  options: string[];
}

// A 'select' value is the option's text, a 'multi_select' value the texts of its
// options; a 'date' value is 'YYYY-MM-DD', a 'datetime' value an ISO timestamp; a
// 'member' value is the person's email, matched with a project member.
export interface CanonicalCustomFieldValue {
  fieldSourceId: string;
  value: string | number | boolean | string[] | null;
}

export interface CanonicalChecklist {
  sourceId: string;
  title: string;
  items: { content: string; done: boolean }[];
}

// No URL field: an attachment's download URL is a presigned link that expires
// (see docs/dev/plane-import-source-notes.md), so it must never be resolved
// ahead of the phase that actually downloads the bytes. sourceId is what a later
// phase resolves it from again, on demand. sizeBytes is the source's own claim,
// used only to skip an obviously-too-large file before downloading it — the
// size actually stored always comes from the downloaded bytes, never this.
export interface CanonicalAttachment {
  sourceId: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
}

// Time a person spent on an issue. Only an author matched with a project member is
// imported: an entry belongs to the member who logged it.
export interface CanonicalWorklog {
  sourceId: string;
  authorEmail: string | null;
  minutes: number;
  // 'YYYY-MM-DD'
  spentOn: string;
  note: string | null;
}

export type CanonicalInitiativeStatus =
  'proposed' | 'planned' | 'active' | 'completed' | 'canceled';

// A group of issues above them: Jira's epic, for one. Issues join it through
// CanonicalIssue.initiativeSourceId.
export interface CanonicalInitiative {
  sourceId: string;
  title: string;
  descriptionMarkdown: string;
  status: CanonicalInitiativeStatus;
  ownerEmail: string | null;
  priority: string | null;
  startDate: string | null;
  targetDate: string | null;
  labelSourceIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CanonicalComment {
  sourceId: string;
  authorEmail: string | null;
  authorName: string;
  bodyMarkdown: string;
  createdAt: string;
  replyToSourceId: string | null;
}

export interface CanonicalRelation {
  kind: 'blocks' | 'relates' | 'duplicates';
  sourceIssueSourceId: string;
  targetIssueSourceId: string;
}

// descriptionMarkdown and a comment's bodyMarkdown may embed one of the issue's own
// attachments by attachmentLink (inline-attachments.ts); the Attachments phase points
// it at the stored file. An initiative's description may do the same with its own.
//
// Comments and attachments are fetched and written per-issue during the Create
// phase, not nested here: keeping this flat means one issue's payload does not
// grow with however many comments or attachments it happens to carry.
export interface CanonicalIssue {
  sourceId: string;
  // The source's own human-readable issue number (Plane's sequence_id), used only
  // to resolve a cross-reference like "ROOMS-524" in another issue's text back to
  // this one during the Rewrite phase.
  sequenceId: number;
  title: string;
  descriptionMarkdown: string;
  stateSourceId: string;
  // Absent for a source without issue types or initiatives.
  typeSourceId?: string | null;
  initiativeSourceId?: string | null;
  assigneeEmail: string | null;
  watcherEmails: string[];
  labelSourceIds: string[];
  cycleSourceId: string | null;
  parentSourceId: string | null;
  priority: string | null;
  startDate: string | null;
  dueDate: string | null;
  // Create turns on the project's estimate kind the first time an issue brings one.
  estimatePoints?: number | null;
  estimateMinutes?: number | null;
  customFields: CanonicalCustomFieldValue[];
  createdAt: string;
  updatedAt: string;
  // Set when the source has the issue archived; the issue is created archived.
  archivedAt: string | null;
}
