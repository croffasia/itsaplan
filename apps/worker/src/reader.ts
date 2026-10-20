import type {
  CanonicalState,
  CanonicalLabel,
  CanonicalCycle,
  CanonicalIssue,
  CanonicalRelation,
  CanonicalComment,
  CanonicalAttachment,
} from './canonical';

// Thrown when a job's source has no entry in the import source registry. No retry
// can fix it, so the worker fails the job at once instead of retrying it.
export class UnsupportedImportSourceError extends Error {
  constructor(jobId: number, source: string) {
    super(`import job ${jobId} has unsupported source "${source}"`);
  }
}

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

// The port a source-specific adapter implements (plane-adapter.ts is the only
// implementation today). Shaped from what import-worker.ts actually needs to
// drive the Discover/Create/Link phases, not speculatively:
//
// - states/labels/cycles are small, unpaginated project-level lists.
// - listIssues walks the source's own pagination for the Discover snapshot.
// - getIssue re-fetches one issue by id: Create resumes from itsaplan's own
//   import_record snapshot, not from the source's pagination position, so it
//   needs a single-item fetch rather than a page walk (see the notes file's
//   "Design consequence" under Pagination).
// - relations, comments and attachments are not part of the main issue
//   payload for Plane, and are unpaginated per-issue lists there too, so they
//   are fetched one issue at a time rather than walked as their own pages.
export interface SourceReader {
  listStates(): Promise<CanonicalState[]>;
  listLabels(): Promise<CanonicalLabel[]>;
  listCycles(): Promise<CanonicalCycle[]>;
  listIssues(cursor: string | null): Promise<Page<CanonicalIssue>>;
  getIssue(sourceId: string): Promise<CanonicalIssue>;
  listIssueRelations(issueSourceId: string): Promise<CanonicalRelation[]>;
  listIssueComments(issueSourceId: string): Promise<CanonicalComment[]>;
  listIssueAttachments(issueSourceId: string): Promise<CanonicalAttachment[]>;
  // Resolves how to download one attachment, fresh each call: the source's own
  // resolved URL is a presigned link that expires (Plane's lasts exactly an
  // hour), so this is called at the moment of download, never cached or
  // resolved ahead of time.
  resolveAttachmentDownload(
    issueSourceId: string,
    attachmentSourceId: string,
  ): Promise<AttachmentDownload>;
}
