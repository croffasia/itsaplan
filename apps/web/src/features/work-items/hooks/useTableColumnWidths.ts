import { useCallback, useEffect, useRef, useState } from 'react';
import { MAX_COLUMN_WIDTH, MIN_COLUMN_WIDTH, type ColumnWidths } from '../utils/table';

// The table's dragged column widths, stored as one object under `storageKey`
// (see columnWidthsKey: one set per project and scope). Reloads when the key
// changes, so switching view picks up that view's widths.
//
// A drag calls setWidth for every pointer move and persistWidths once at its end,
// so the synchronous localStorage write happens once per drag rather than per move.
//
// The stored value is read in an effect, not in the state initializer: the
// initializer also runs in the server render, where a client-only value would not
// match the markup.
export function useTableColumnWidths(storageKey: string): {
  widths: ColumnWidths;
  setWidth: (columnKey: string, width: number) => void;
  persistWidths: () => void;
} {
  const [widths, setWidths] = useState<ColumnWidths>({});

  // persistWidths runs from a window pointerup handler, and from the resizer's
  // unmount cleanup, so it reads the current widths from a ref instead of a
  // captured render value.
  const latest = useRef(widths);
  useEffect(() => {
    latest.current = widths;
  }, [widths]);

  useEffect(() => {
    setWidths(load(storageKey));
  }, [storageKey]);

  const setWidth = useCallback((columnKey: string, width: number) => {
    setWidths((prev) => ({ ...prev, [columnKey]: clamp(width) }));
  }, []);

  const persistWidths = useCallback(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(latest.current));
    } catch {
      // ignore write failures (private mode / quota); the width still applies.
    }
  }, [storageKey]);

  return { widths, setWidth, persistWidths };
}

function load(storageKey: string): ColumnWidths {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '');
    if (!stored || typeof stored !== 'object') return {};
    const widths: ColumnWidths = {};
    for (const [key, value] of Object.entries(stored)) {
      if (typeof value === 'number' && Number.isFinite(value)) widths[key] = clamp(value);
    }
    return widths;
  } catch {
    return {};
  }
}

function clamp(width: number): number {
  return Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, Math.round(width)));
}
