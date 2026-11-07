import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Editor } from '@tiptap/react';
import { Step } from '@tiptap/pm/transform';
import { history } from '@tiptap/pm/history';
import { collab, getVersion, receiveTransaction, sendableSteps } from 'prosemirror-collab';
import { ApiError } from '@/lib/api/core/client';
import {
  type ProjectDocument,
  getDocument,
  getDocumentChanges,
  saveDocumentChanges,
  openDocumentSession,
} from '@/lib/api/endpoints/documents';
import { qk } from '@/services/queryKeys';
import { uuid } from '@/utils/uuid';
import {
  persistDocumentRecovery,
  readDocumentRecovery,
  type DocumentSessionState,
} from '../utils/documentRecovery';
import { markdownJson } from '../utils/documentImport';

export type DocumentSyncState =
  'connecting' | 'saved' | 'saving' | 'offline' | 'error' | 'conflict';

export function useDocumentCollaboration({
  editor,
  projectKey,
  document,
  userId,
  enabled,
  onSaved,
}: {
  editor: Editor | null;
  projectKey: string;
  document: ProjectDocument;
  userId: string | null;
  enabled: boolean;
  onSaved: (document: ProjectDocument) => void;
}) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<DocumentSyncState>('connecting');
  const [ready, setReady] = useState(false);
  const state = useRef<(DocumentSessionState & { recovering: boolean }) | null>(null);
  const saving = useRef<Promise<ProjectDocument | null> | null>(null);
  const latest = useRef({ document, onSaved });
  latest.current = { document, onSaved };
  const storageKey = `document-steps:${userId}:${projectKey}:${document.id}`;
  const [attempt, setAttempt] = useState(0);
  const [recoveryConflict, setRecoveryConflict] = useState(false);
  const confirmedVersion = useRef(document.version);

  const persist = useCallback(
    () => persistDocumentRecovery(storageKey, state.current),
    [storageKey],
  );

  const receive = useCallback(async () => {
    if (!editor || editor.isDestroyed || !state.current) return;
    const activeSession = state.current;
    let more = true;
    while (more) {
      const result = await getDocumentChanges(
        projectKey,
        document.id,
        state.current.epoch,
        getVersion(editor.state),
      );
      if (editor.isDestroyed || state.current !== activeSession) return;
      const steps = result.steps.map((item) => Step.fromJSON(editor.schema, item.step));
      const pending = sendableSteps(editor.state);
      // A cloned recovery can share an id, but different steps are never our acknowledgement.
      for (
        let i = 0;
        i < steps.length && result.steps[i].clientId === activeSession.clientId;
        i++
      ) {
        const expected = pending?.steps[i];
        if (!expected && activeSession.recovering) continue;
        if (!expected || !sameStepJson(expected.toJSON(), steps[i].toJSON()))
          throw new ApiError(409, 'Document acknowledgement does not match the local changes');
      }
      confirmedVersion.current = result.documentVersion;
      for (const step of steps) {
        const applied = step.apply(state.current.confirmed);
        if (!applied.doc) throw new Error('Invalid remote document change');
        state.current.confirmed = applied.doc;
      }
      if (steps.length)
        editor.view.dispatch(
          receiveTransaction(
            editor.state,
            steps,
            result.steps.map((item) => item.clientId),
            { mapSelectionBackward: true },
          ),
        );
      state.current.snapshot = editor.state;
      more = result.hasMore;
    }
    persist();
  }, [document.id, editor, persist, projectKey]);

  const flush = useCallback((): Promise<ProjectDocument | null> => {
    if (saving.current) return saving.current;
    if (!enabled || !editor || editor.isDestroyed || !state.current) return Promise.resolve(null);
    const activeSession = state.current;
    const operation = async () => {
      persist();
      if (!navigator.onLine) {
        setStatus('offline');
        return null;
      }
      setStatus('saving');
      try {
        let saved: ProjectDocument | null = null;
        for (let retry = 0; retry < 5; retry++) {
          await receive();
          if (editor.isDestroyed || state.current !== activeSession) return null;
          const pending = sendableSteps(editor.state);
          if (!pending) {
            saved ??= latest.current.document;
            if (saved.version < confirmedVersion.current) {
              saved = await getDocument(projectKey, document.id);
              if (editor.isDestroyed || state.current !== activeSession) return null;
              latest.current.onSaved(saved);
            }
            setStatus('saved');
            return saved;
          }
          try {
            const batch = pending.steps.slice(0, 1000);
            let snapshot = editor.state.doc;
            if (batch.length !== pending.steps.length) {
              snapshot = activeSession.confirmed;
              for (const step of batch) {
                const applied = step.apply(snapshot);
                if (!applied.doc) throw new Error('Invalid local document change');
                snapshot = applied.doc;
              }
            }
            saved = await saveDocumentChanges(projectKey, document.id, {
              epoch: state.current.epoch,
              version: pending.version,
              clientId: state.current.clientId,
              steps: batch.map((step) => step.toJSON()),
              content: editor.storage.markdown.serializer.serialize(snapshot),
            });
            if (editor.isDestroyed || state.current !== activeSession) return null;
            latest.current.onSaved(saved);
            qc.setQueryData(qk.document(projectKey, document.id), saved);
          } catch (error) {
            if (!(error instanceof ApiError && error.status === 409)) throw error;
          }
        }
        await receive();
        if (editor.isDestroyed || state.current !== activeSession) return null;
        setStatus(sendableSteps(editor.state) ? 'error' : 'saved');
        return sendableSteps(editor.state) ? null : saved;
      } catch (error) {
        if (editor.isDestroyed || state.current !== activeSession) return null;
        if (error instanceof ApiError && error.status === 409 && !sendableSteps(editor.state)) {
          setReady(false);
          setAttempt((value) => value + 1);
          return null;
        }
        if (error instanceof ApiError && error.status === 409) {
          setRecoveryConflict(true);
          setReady(false);
        }
        setStatus(
          !navigator.onLine
            ? 'offline'
            : error instanceof ApiError && [403, 404, 409].includes(error.status)
              ? 'conflict'
              : 'error',
        );
        return null;
      } finally {
        persist();
      }
    };
    const pending = operation().finally(() => {
      if (saving.current === pending) saving.current = null;
    });
    saving.current = pending;
    return pending;
  }, [document.id, editor, enabled, persist, projectKey, qc, receive]);

  useEffect(() => {
    if (!editor || !userId || !enabled) return;
    let cancelled = false;
    const start = async () => {
      setStatus('connecting');
      try {
        // The seed must come from the same version as the one sent: the editor can
        // still show an older body after another writer replaced the Markdown.
        const current = latest.current.document;
        const session = await openDocumentSession(
          projectKey,
          document.id,
          current.version,
          current.contentJson ?? markdownJson(editor, current.content),
        );
        if (cancelled || editor.isDestroyed) return;
        const recovery = readDocumentRecovery(storageKey);
        const canRecover = recovery?.epoch === session.epoch;
        const base = editor.schema.nodeFromJSON(recovery ? recovery.base : session.contentJson);
        base.check();
        editor
          .chain()
          .setContent(base.toJSON(), { emitUpdate: false })
          .setMeta('addToHistory', false)
          .run();
        editor.unregisterPlugin('history');
        editor.registerPlugin(history());
        const tr = editor.state.tr;
        // A stored step that no longer applies can never be saved: the steps before it go to export.
        const replayed = (recovery?.steps ?? []).every((json) => {
          try {
            return !tr.maybeStep(Step.fromJSON(editor.schema, json)).failed;
          } catch {
            return false;
          }
        });
        if (recovery && (!canRecover || !replayed)) {
          editor.view.dispatch(tr);
          setRecoveryConflict(true);
          setStatus('conflict');
          return;
        }
        const clientId = recovery?.clientId ?? uuid();
        editor.registerPlugin(
          collab({ version: recovery?.version ?? session.version, clientID: clientId }),
        );
        state.current = {
          epoch: session.epoch,
          clientId,
          confirmed: base,
          snapshot: editor.state,
          recovering: Boolean(recovery),
        };
        if (recovery) {
          editor.view.dispatch(tr);
          state.current.snapshot = editor.state;
        }
        setRecoveryConflict(false);
        if (recovery) {
          const activeSession = state.current;
          const saved = await flush();
          if (cancelled || editor.isDestroyed || state.current !== activeSession || !saved) return;
          if (sendableSteps(editor.state)) {
            setStatus('error');
            return;
          }
          // Drain the restored identity before accepting edits under a fresh one.
          const version = getVersion(editor.state);
          editor.unregisterPlugin('collab');
          editor
            .chain()
            .setContent(activeSession.confirmed.toJSON(), { emitUpdate: false })
            .setMeta('addToHistory', false)
            .run();
          editor.unregisterPlugin('history');
          editor.registerPlugin(history());
          activeSession.clientId = uuid();
          activeSession.recovering = false;
          editor.registerPlugin(collab({ version, clientID: activeSession.clientId }));
          activeSession.snapshot = editor.state;
        }
        setReady(true);
        setStatus('saved');
      } catch (error) {
        console.error('[document-session]', error);
        if (!cancelled) setStatus(navigator.onLine ? 'error' : 'offline');
      }
    };
    void start();
    return () => {
      cancelled = true;
      persist();
      state.current = null;
      saving.current = null;
      setReady(false);
      if (!editor.isDestroyed) editor.unregisterPlugin('collab');
    };
  }, [attempt, document.id, editor, enabled, flush, persist, projectKey, storageKey, userId]);

  useEffect(() => {
    if (!editor || !ready) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // A menu or selection update must not retry a refused save.
    const changed = () => {
      if (!state.current || editor.isDestroyed || editor.state.doc === state.current.snapshot.doc)
        return;
      state.current.snapshot = editor.state;
      if (!sendableSteps(editor.state)) return;
      setStatus('saving');
      clearTimeout(timer);
      timer = setTimeout(() => {
        persist();
        void flush();
      }, 350);
    };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      persist();
      if (state.current && !editor.isDestroyed && sendableSteps(editor.state))
        event.preventDefault();
    };
    const online = () => {
      void flush();
    };
    const offline = () => setStatus('offline');
    editor.on('transaction', changed);
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    window.addEventListener('pagehide', persist);
    window.addEventListener('beforeunload', beforeUnload);
    void flush();
    return () => {
      clearTimeout(timer);
      persist();
      editor.off('transaction', changed);
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
      window.removeEventListener('pagehide', persist);
      window.removeEventListener('beforeunload', beforeUnload);
    };
  }, [editor, flush, persist, ready]);

  useEffect(() => {
    if (ready) void flush();
  }, [document.version, flush, ready]);
  useEffect(() => {
    if (ready || recoveryConflict) return;
    const reconnect = () => setAttempt((value) => value + 1);
    window.addEventListener('online', reconnect);
    return () => window.removeEventListener('online', reconnect);
  }, [ready, recoveryConflict]);
  const discardRecovery = () => {
    state.current = null;
    window.sessionStorage.removeItem(storageKey);
    setRecoveryConflict(false);
    setAttempt((value) => value + 1);
  };
  return {
    status,
    version: confirmedVersion.current,
    ready,
    openFailed: !ready && (status === 'error' || status === 'offline'),
    flush,
    recoveryConflict,
    discardRecovery,
    retry: () => {
      if (ready) void flush();
      else setAttempt((value) => value + 1);
    },
  };
}

function sameStepJson(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (left === null || right === null || typeof left !== 'object' || typeof right !== 'object')
    return false;
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  const keys = Object.keys(left);
  return (
    keys.length === Object.keys(right).length &&
    keys.every(
      (key) =>
        Object.hasOwn(right, key) &&
        sameStepJson(
          (left as Record<string, unknown>)[key],
          (right as Record<string, unknown>)[key],
        ),
    )
  );
}
