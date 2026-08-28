'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  confirmImport as confirmImportRequest,
  discardImport,
  getImport,
  type ImportConfirmResult,
  type IssueImport,
} from '@/lib/api';

// One import draft, read by the review card the agent's ```issue-import fence
// renders. The card is drawn wherever the answer sits, so it re-reads the draft
// from its id and keeps the confirm/cancel outcomes local to itself.
export function useImportDraft(importId: string) {
  const [draft, setDraft] = useState<IssueImport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportConfirmResult | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    getImport(importId)
      .then((d) => {
        if (live) setDraft(d);
      })
      .catch((err: Error) => {
        if (live) setError(err.message);
      });
    return () => {
      live = false;
    };
  }, [importId]);

  const confirm = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      setResult(await confirmImportRequest(importId));
      setDraft((d) => (d ? { ...d, status: 'confirmed' } : d));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [importId]);

  const discard = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await discardImport(importId);
      setDraft((d) => (d ? { ...d, status: 'canceled' } : d));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [importId]);

  return { draft, error, result, busy, confirm, discard };
}
