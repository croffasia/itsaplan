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
}

export interface CanonicalCycle {
  sourceId: string;
  name: string;
  // Date-only ('YYYY-MM-DD'): itsaplan's cycle.startDate/endDate carry no time of day.
  startDate: string;
  endDate: string;
  goal?: string;
}

export interface CanonicalCustomFieldValue {
  fieldSourceId: string;
  value: string | number | boolean | null;
}

// No URL field: an attachment's download URL is a presigned link that expires
// (see docs/dev/plane-import-source-notes.md), so it must never be resolved
// ahead of the phase that actually downloads the bytes. sourceId is what a later
// phase resolves it from again, on demand.
export interface CanonicalAttachment {
  sourceId: string;
  filename: string;
  contentType: string;
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
  assigneeEmail: string | null;
  labelSourceIds: string[];
  cycleSourceId: string | null;
  parentSourceId: string | null;
  priority: string | null;
  startDate: string | null;
  dueDate: string | null;
  customFields: CanonicalCustomFieldValue[];
  createdAt: string;
  updatedAt: string;
}
