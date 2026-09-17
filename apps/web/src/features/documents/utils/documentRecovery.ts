import type { Node } from '@tiptap/pm/model';
import type { EditorState } from '@tiptap/pm/state';
import { sendableSteps } from 'prosemirror-collab';

export type DocumentRecovery = {
  epoch: string;
  version: number;
  clientId: string;
  base: Record<string, unknown>;
  steps: Record<string, unknown>[];
};
export type DocumentSessionState = {
  epoch: string;
  clientId: string;
  confirmed: Node;
  snapshot: EditorState;
};

export function readDocumentRecovery(key: string): DocumentRecovery | null {
  try {
    const value = JSON.parse(window.sessionStorage.getItem(key) ?? 'null');
    if (
      !value ||
      typeof value.epoch !== 'string' ||
      typeof value.clientId !== 'string' ||
      !Number.isSafeInteger(value.version) ||
      value.version < 0 ||
      !value.base ||
      !Array.isArray(value.steps)
    )
      return null;
    return value;
  } catch {
    return null;
  }
}

export function persistDocumentRecovery(key: string, session: DocumentSessionState | null) {
  if (!session) return;
  try {
    const pending = sendableSteps(session.snapshot);
    if (!pending) {
      window.sessionStorage.removeItem(key);
      return;
    }
    window.sessionStorage.setItem(
      key,
      JSON.stringify({
        epoch: session.epoch,
        version: pending.version,
        clientId: session.clientId,
        base: session.confirmed.toJSON(),
        steps: pending.steps.map((step) => step.toJSON()),
      } satisfies DocumentRecovery),
    );
  } catch {
    /* Browser storage can be disabled or full. */
  }
}
