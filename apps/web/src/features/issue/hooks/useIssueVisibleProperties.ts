import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { IssuePatch } from '@/lib/api/endpoints/issues';
import {
  useIssuePropertyRows,
  type IssuePropertyRowSpec,
  type IssuePropertyRowsInput,
} from './useIssuePropertyRows';

// The row each optional built-in field of a patch belongs to.
const PATCH_ROWS: Partial<Record<keyof IssuePatch, string>> = {
  initiativeId: 'initiative',
  cycleId: 'cycle',
  startDate: 'startDate',
  estimatePoints: 'estimatePoints',
  estimateMinutes: 'estimateTime',
};

// The property rows with the empty optional ones left out: the custom fields only, or
// every optional field. A row stays once it was added from the menu or edited here, so
// clearing a value does not take the row away from under the pointer; the caller mounts
// this per issue, which forgets them.
export function useIssueVisibleProperties(input: IssuePropertyRowsInput, hides: 'custom' | 'all') {
  const t = useTranslations('issue.fields');
  const [kept, setKept] = useState<(string | number)[]>([]);
  const [openKey, setOpenKey] = useState<string | number | null>(null);
  const keep = (key: string | number) =>
    setKept((prev) => (prev.includes(key) ? prev : [...prev, key]));

  // An editor reads openKey only when it mounts, so it is cleared once the added row
  // has mounted: a row mounted again later, its group or section folded and unfolded,
  // starts closed.
  useEffect(() => {
    if (openKey !== null) setOpenKey(null);
  }, [openKey]);

  const groups = useIssuePropertyRows({
    ...input,
    openKey,
    onPatch: (fields) => {
      for (const field of Object.keys(fields) as (keyof IssuePatch)[]) {
        const row = PATCH_ROWS[field];
        if (row) keep(row);
      }
      input.onPatch(fields);
    },
    onSetField: (fieldId, value) => {
      keep(fieldId);
      input.onSetField(fieldId, value);
    },
  });
  const isHidden = (row: IssuePropertyRowSpec) =>
    row.filled === false && (hides === 'all' || row.custom === true) && !kept.includes(row.key);

  return {
    groups,
    isHidden,
    // The left-out rows under their group's name, for the menu that adds one.
    addable: groups
      .map((group) => ({ heading: t(group.key), rows: group.rows.filter(isHidden) }))
      .filter((group) => group.rows.length > 0),
    // Shows a left-out row with its editor open.
    add: (key: string | number) => {
      keep(key);
      setOpenKey(key);
    },
  };
}
