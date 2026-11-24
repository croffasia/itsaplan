import type {
  CanonicalState,
  CanonicalLabel,
  CanonicalIssueType,
  CanonicalInitiative,
  CanonicalWorklog,
  CanonicalCycle,
  CanonicalCustomField,
  CanonicalChecklist,
  CanonicalIssue,
  CanonicalRelation,
  CanonicalComment,
  CanonicalAttachment,
} from './canonical';

// Thrown by a source adapter when the source's rate limit is reached. The worker
// reschedules the job after retryAfterMs; a rate limit is waited out and does not
// count toward the attempt limit.
export class SourceRateLimitedError extends Error {
  constructor(
    public readonly retryAfterMs: number,
    message = 'source rate limit reached',
  ) {
    super(message);
  }
}

// headers is for a source whose file host needs the source's own credential; the
// Attachments phase sends them with the download and nowhere else.
export interface AttachmentDownload {
  url: string;
  headers?: Record<string, string>;
}

// One page of a cursor-paginated list. cursor is the exact, opaque value the
// source API returned for the next page, or null when there is no next page.
// It must be passed back to the source verbatim — never reconstructed — and a
// caller must stop on cursor === null rather than inferring completion from
// the page size (see docs/dev/plane-import-source-notes.md).
export interface Page<T> {
  items: T[];
  cursor: string | null;
}

// What the job reads (a board, a team or a project), as the job's card names it, and
// the address that opens it in the source, or null for none.
export interface SourceProject {
  name: string;
  url: string | null;
}

// The port a source-specific adapter implements (plane-adapter.ts,
// linear-adapter.ts, trello-adapter.ts). Shaped from what import-worker.ts
// actually needs to drive the Discover/Create/Link phases, not speculatively:
//
// - states/labels/cycles/custom fields are small, unpaginated project-level
//   lists. A source without one of them returns [].
// - listIssues walks the source's own pagination for the Discover snapshot.
// - getIssue re-fetches one issue by id: Create resumes from itsaplan's own
//   import_record snapshot, not from the source's pagination position, so it
//   needs a single-item fetch rather than a page walk (see the notes file's
//   "Design consequence" under Pagination).
// - relations, comments and attachments are not part of the main issue
//   payload for Plane, and are unpaginated per-issue lists there too, so they
//   are fetched one issue at a time rather than walked as their own pages.
// - issue types, initiatives and worklogs are read only from a source that has
//   them; the others leave the methods out.
// - describeSource is read once, as Discover starts.
export interface SourceReader {
  describeSource(): Promise<SourceProject>;
  listStates(): Promise<CanonicalState[]>;
  listLabels(): Promise<CanonicalLabel[]>;
  listCycles(): Promise<CanonicalCycle[]>;
  listCustomFields(): Promise<CanonicalCustomField[]>;
  listIssueTypes?(): Promise<CanonicalIssueType[]>;
  listInitiatives?(): Promise<CanonicalInitiative[]>;
  listIssues(cursor: string | null): Promise<Page<CanonicalIssue>>;
  getIssue(sourceId: string): Promise<CanonicalIssue>;
  listIssueRelations(issueSourceId: string): Promise<CanonicalRelation[]>;
  listIssueComments(issueSourceId: string): Promise<CanonicalComment[]>;
  listIssueAttachments(issueSourceId: string): Promise<CanonicalAttachment[]>;
  listIssueChecklists(issueSourceId: string): Promise<CanonicalChecklist[]>;
  listIssueWorklogs?(issueSourceId: string): Promise<CanonicalWorklog[]>;
  listInitiativeAttachments?(initiativeSourceId: string): Promise<CanonicalAttachment[]>;
  // Resolves how to download one attachment, fresh each call: the source's own
  // resolved URL is a presigned link that expires (Plane's lasts exactly an
  // hour), so this is called at the moment of download, never cached or
  // resolved ahead of time. ownerSourceId is the issue's, or the initiative's for a
  // file listInitiativeAttachments returned.
  resolveAttachmentDownload(
    ownerSourceId: string,
    attachmentSourceId: string,
  ): Promise<AttachmentDownload>;
}
