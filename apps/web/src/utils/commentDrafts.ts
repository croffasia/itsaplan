// Unsent comment text, kept in this browser so that closing the issue, opening another
// one or reloading the page does not lose it. A draft belongs to one user, one issue
// and one box: the new-comment box, the reply box under a comment, or the edit box of
// a comment. A draft not changed for 30 days is dropped; signing out drops them all.

const PREFIX = 'itsaplan:comment-draft:';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export type CommentDraftBox = 'new' | `reply:${number}` | `edit:${number}`;

let pruned = false;

const draftKey = (userId: string, issueId: number, box: CommentDraftBox) =>
  `${PREFIX}${userId}:${issueId}:${box}`;

function readOrDrop(key: string): string | null {
  const raw = localStorage.getItem(key);
  if (raw == null) return null;
  try {
    const draft = JSON.parse(raw) as { body?: unknown; savedAt?: unknown };
    if (
      typeof draft.body === 'string' &&
      typeof draft.savedAt === 'number' &&
      Date.now() - draft.savedAt < MAX_AGE_MS
    )
      return draft.body;
  } catch {
    // An unreadable entry is dropped like an expired one.
  }
  localStorage.removeItem(key);
  return null;
}

function eachDraftKey(visit: (key: string) => void) {
  for (const key of Object.keys(localStorage)) if (key.startsWith(PREFIX)) visit(key);
}

export function readCommentDraft(userId: string, issueId: number, box: CommentDraftBox) {
  try {
    // The first read of a page load also drops the expired drafts of issues and
    // comments nobody opens again.
    if (!pruned) {
      pruned = true;
      eachDraftKey(readOrDrop);
    }
    return readOrDrop(draftKey(userId, issueId, box));
  } catch {
    // Storage disabled (private mode): there is no draft.
    return null;
  }
}

// `null` removes the draft.
export function writeCommentDraft(
  userId: string,
  issueId: number,
  box: CommentDraftBox,
  body: string | null,
) {
  try {
    const key = draftKey(userId, issueId, box);
    if (body == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify({ body, savedAt: Date.now() }));
  } catch {
    // A full or disabled storage keeps no draft; the box still works.
  }
}

export function clearCommentDrafts() {
  try {
    eachDraftKey((key) => localStorage.removeItem(key));
  } catch {
    // Storage disabled: there is nothing stored to clear.
  }
}
