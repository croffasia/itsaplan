import { useCallback, useEffect, useRef, useState } from 'react';
import type { ProjectDocument } from '@/lib/api';
import { ApiError } from '@/lib/api';
import { uuid } from '@/utils/uuid';
import { useUpdateDocument } from '../services/documents.service';

export type DocumentSaveState = 'saved' | 'saving' | 'conflict' | 'error';

const AUTOSAVE_DELAY_MS = 700;

interface StoredDocumentDraft {
  title: string;
  content: string;
  contentJson?: Record<string, unknown> | null;
  baseVersion: number;
  writerId?: string;
}

function draftStorageKey(projectKey: string, documentId: number, userId: string) {
  return `itsaplan:document-draft:${userId}:${projectKey}:${documentId}`;
}

function storedDraft(value: string | null): StoredDocumentDraft | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      typeof (parsed as StoredDocumentDraft).title !== 'string' ||
      typeof (parsed as StoredDocumentDraft).content !== 'string' ||
      ((parsed as StoredDocumentDraft).contentJson !== undefined &&
        (parsed as StoredDocumentDraft).contentJson !== null &&
        typeof (parsed as StoredDocumentDraft).contentJson !== 'object') ||
      !Number.isInteger((parsed as StoredDocumentDraft).baseVersion) ||
      ((parsed as StoredDocumentDraft).writerId !== undefined &&
        typeof (parsed as StoredDocumentDraft).writerId !== 'string')
    ) {
      return null;
    }
    return parsed as StoredDocumentDraft;
  } catch {
    return null;
  }
}

function rebaseStoredDraft(
  storageKey: string | null,
  writerId: string,
  fromVersion: number,
  toVersion: number,
) {
  if (!storageKey) return;
  try {
    const local = storedDraft(window.localStorage.getItem(storageKey));
    // Do not overwrite a draft already rebased by another save/tab. Keeping the
    // text unchanged is important: it may contain edits newer than this request.
    if (!local || local.writerId !== writerId || local.baseVersion !== fromVersion) return;
    window.localStorage.setItem(storageKey, JSON.stringify({ ...local, baseVersion: toVersion }));
  } catch {
    // Recovery storage is best effort; the server save still succeeded.
  }
}

function removeOwnedStoredDraft(storageKey: string | null, writerId: string) {
  if (!storageKey) return;
  const rawStoredDraft = window.localStorage.getItem(storageKey);
  const local = storedDraft(rawStoredDraft);
  // The recovery key is shared by every tab for this account and page. A clean
  // tab must not delete a newer draft written by another mounted tab. Legacy
  // drafts have no writer id, so preserve them until a tab restores and rewrites
  // them as its own.
  if (rawStoredDraft !== null && local?.writerId === writerId) {
    window.localStorage.removeItem(storageKey);
  }
}

export function useDocumentDraft({
  projectKey,
  document,
  editable,
  userId,
}: {
  projectKey: string;
  document: ProjectDocument;
  editable: boolean;
  userId: string | null;
}) {
  const { mutateAsync } = useUpdateDocument(projectKey);
  const versionRef = useRef(document.version);
  const savingRef = useRef(false);
  const writerIdRef = useRef(uuid());
  const [version, setVersion] = useState(document.version);
  const [title, setTitleState] = useState(document.title);
  const [content, setContentState] = useState(document.content);
  const [contentJson, setContentJsonState] = useState(document.contentJson);
  const [saved, setSaved] = useState({
    title: document.title,
    content: document.content,
    contentJson: JSON.stringify(document.contentJson),
  });
  const [draftBaseVersion, setDraftBaseVersion] = useState(document.version);
  const [saveState, setSaveState] = useState<DocumentSaveState>('saved');
  const [editorRevision, setEditorRevision] = useState(0);
  const [restoredStorageKey, setRestoredStorageKey] = useState<string | null>(null);
  const dirty =
    title !== saved.title ||
    content !== saved.content ||
    JSON.stringify(contentJson) !== saved.contentJson;
  const storageKey = userId ? draftStorageKey(projectKey, document.id, userId) : null;

  // Keep an on-device recovery copy. Unlike beforeunload, this also survives
  // App Router links and browser Back/Forward, where React can unmount the editor
  // before an unsuccessful autosave reports its error.
  useEffect(() => {
    if (!storageKey || restoredStorageKey === storageKey) return;
    let local: StoredDocumentDraft | null = null;
    try {
      local = storedDraft(window.localStorage.getItem(storageKey));
    } catch {
      // Private browsing policies may make even reading storage throw.
    }
    versionRef.current = document.version;
    setDraftBaseVersion(local?.baseVersion ?? document.version);
    setSaved({
      title: document.title,
      content: document.content,
      contentJson: JSON.stringify(document.contentJson),
    });
    setTitleState(local?.title ?? document.title);
    setContentState(local?.content ?? document.content);
    setContentJsonState(local ? (local.contentJson ?? null) : document.contentJson);
    setSaveState(local && local.baseVersion !== document.version ? 'conflict' : 'saved');
    setEditorRevision((revision) => revision + 1);
    setRestoredStorageKey(storageKey);
  }, [
    document.content,
    document.contentJson,
    document.title,
    document.version,
    restoredStorageKey,
    storageKey,
  ]);

  // A scope refresh can replace the query data while this editor stays mounted.
  // Own writes update versionRef before their query result settles, so equality is
  // also what prevents a successful autosave from remounting Tiptap and moving the
  // cursor. A genuinely newer remote version is adopted only when there is no local
  // work to protect; otherwise the existing conflict flow lets the user review it.
  useEffect(() => {
    if (document.version <= versionRef.current) return;
    if (dirty || savingRef.current) {
      setSaveState('conflict');
      return;
    }
    versionRef.current = document.version;
    setVersion(document.version);
    setDraftBaseVersion(document.version);
    setTitleState(document.title);
    setContentState(document.content);
    setContentJsonState(document.contentJson);
    setSaved({
      title: document.title,
      content: document.content,
      contentJson: JSON.stringify(document.contentJson),
    });
    setSaveState('saved');
    setEditorRevision((revision) => revision + 1);
  }, [dirty, document.content, document.contentJson, document.title, document.version]);

  useEffect(() => {
    if (!storageKey || restoredStorageKey !== storageKey) return;
    try {
      if (dirty) {
        window.localStorage.setItem(
          storageKey,
          JSON.stringify({
            title,
            content,
            contentJson,
            baseVersion: draftBaseVersion,
            writerId: writerIdRef.current,
          }),
        );
      } else {
        removeOwnedStoredDraft(storageKey, writerIdRef.current);
      }
    } catch {
      // A full or disabled storage must not prevent editing or autosave.
    }
  }, [content, contentJson, dirty, draftBaseVersion, restoredStorageKey, storageKey, title]);

  const save = useCallback(async (): Promise<ProjectDocument | null> => {
    if (!editable || !dirty || savingRef.current || saveState === 'conflict') return null;

    const snapshot = { title, content, contentJson };
    const baseVersion = versionRef.current;
    savingRef.current = true;
    setSaveState('saving');
    try {
      const updated = await mutateAsync({
        documentId: document.id,
        patch: {
          version: baseVersion,
          title: snapshot.title,
          content: snapshot.content,
          contentJson: snapshot.contentJson,
        },
      });
      versionRef.current = updated.version;
      setVersion(updated.version);
      // This direct write also runs when navigation unmounted the editor while
      // the request was in flight, where a React state/effect update cannot.
      rebaseStoredDraft(storageKey, writerIdRef.current, baseVersion, updated.version);
      // A user may keep typing while this request is in flight. Advancing the
      // recovery draft's base version keeps those newer edits saveable after a
      // navigation or remount, even before the next autosave fires.
      setDraftBaseVersion(updated.version);
      setSaved({ ...snapshot, contentJson: JSON.stringify(snapshot.contentJson) });
      setSaveState('saved');
      return updated;
    } catch (error) {
      setSaveState(error instanceof ApiError && error.status === 409 ? 'conflict' : 'error');
      return null;
    } finally {
      savingRef.current = false;
    }
  }, [
    content,
    contentJson,
    dirty,
    document.id,
    editable,
    mutateAsync,
    saveState,
    storageKey,
    title,
  ]);

  useEffect(() => {
    if (!editable || !dirty || saveState === 'conflict' || saveState === 'error') return;
    const timer = window.setTimeout(() => void save(), AUTOSAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [dirty, editable, save, saveState]);

  useEffect(() => {
    if (!dirty) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warnBeforeLeaving);
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving);
  }, [dirty]);

  const setTitle = (value: string) => {
    setTitleState(value);
    setSaveState((state) => (state === 'error' ? 'saved' : state));
  };

  const setContent = (value: string, json: Record<string, unknown>) => {
    setContentState(value);
    setContentJsonState(json);
    setSaveState((state) => (state === 'error' ? 'saved' : state));
  };

  const replaceWith = (latest: ProjectDocument) => {
    try {
      removeOwnedStoredDraft(storageKey, writerIdRef.current);
    } catch {
      // Reloading from the server still works when storage is unavailable.
    }
    versionRef.current = latest.version;
    setVersion(latest.version);
    setDraftBaseVersion(latest.version);
    setTitleState(latest.title);
    setContentState(latest.content);
    setContentJsonState(latest.contentJson);
    setSaved({
      title: latest.title,
      content: latest.content,
      contentJson: JSON.stringify(latest.contentJson),
    });
    setSaveState('saved');
    // Tiptap owns its document after mount. Remounting is the reliable way to
    // replace it after resolving an optimistic-concurrency conflict.
    setEditorRevision((revision) => revision + 1);
  };

  const adoptServerDocument = (latest: ProjectDocument) => {
    const previousVersion = versionRef.current;
    versionRef.current = latest.version;
    setVersion(latest.version);
    setDraftBaseVersion(latest.version);
    rebaseStoredDraft(storageKey, writerIdRef.current, previousVersion, latest.version);
  };

  return {
    title,
    content,
    contentJson,
    dirty,
    saveState,
    version,
    editorRevision,
    setTitle,
    setContent,
    save,
    replaceWith,
    adoptServerDocument,
  };
}
