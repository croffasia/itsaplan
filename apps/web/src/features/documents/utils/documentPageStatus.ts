import type { DocumentSyncState } from '../hooks/useDocumentCollaboration';
import type { DocumentSaveState } from '../hooks/useDocumentDraft';

export type DocumentPageStatus =
  | 'archived'
  | 'viewOnly'
  | 'locked'
  | 'recovery'
  | 'sessionConflict'
  | 'offline'
  | 'connecting'
  | 'error'
  | 'conflict'
  | 'saving'
  | 'saved';

// The one state the page header reports; the first match wins. `sync` is null when no
// collaboration session runs for the page.
export function documentPageStatus(page: {
  archived: boolean;
  canEdit: boolean;
  locked: boolean;
  sync: DocumentSyncState | null;
  recovery: boolean;
  save: DocumentSaveState;
  dirty: boolean;
}): DocumentPageStatus {
  if (page.archived) return 'archived';
  if (!page.canEdit) return 'viewOnly';
  if (page.locked) return 'locked';
  if (page.recovery) return 'recovery';
  if (page.sync === 'conflict') return 'sessionConflict';
  if (page.sync === 'offline') return 'offline';
  if (page.sync === 'connecting') return 'connecting';
  if (page.sync === 'error' || page.save === 'error') return 'error';
  if (page.save === 'conflict') return 'conflict';
  if (page.sync === 'saving' || page.save === 'saving' || page.dirty) return 'saving';
  return 'saved';
}
