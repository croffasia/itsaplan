import { useEffect, useRef, useState } from 'react';
import type { BoardIssue } from '@/lib/api/endpoints/issues';
import type { CustomField } from '@/lib/api/endpoints/customFields';
import { prepareColumnSearchEntries, type ColumnSearchEntry } from '../utils/columnSearch';

export function useColumnSearchEntries(
  issues: BoardIssue[],
  fields: CustomField[],
  enabled: boolean,
) {
  const cache = useRef(new Map<number, { signature: string; entry: ColumnSearchEntry }>());
  const fieldSignature = JSON.stringify(fields);
  const cachedFields = useRef(fieldSignature);
  const [prepared, setPrepared] = useState<{
    issues: BoardIssue[];
    fields: string;
    entries: ColumnSearchEntry[];
  } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (cachedFields.current !== fieldSignature) {
      cache.current.clear();
      cachedFields.current = fieldSignature;
    }
    let index = 0;
    let canceled = false;
    const entries: ColumnSearchEntry[] = [];
    const seen = new Set<number>();
    const prepareBatch = () => {
      if (canceled) return;
      const start = performance.now();
      while (index < issues.length) {
        const issue = issues[index++];
        if (issue.archivedAt || seen.has(issue.id)) continue;
        seen.add(issue.id);
        const signature = JSON.stringify([
          issue.title,
          issue.identifier,
          issue.description,
          issue.fieldValues,
        ]);
        let cached = cache.current.get(issue.id);
        if (cached?.signature !== signature) {
          const entry = prepareColumnSearchEntries([issue], fields)[0];
          if (!entry) continue;
          cached = { signature, entry };
          cache.current.set(issue.id, cached);
        }
        entries.push({ ...cached.entry, issue });
        if (performance.now() - start >= 8) break;
      }
      if (index < issues.length) timer = window.setTimeout(prepareBatch, 0);
      else setPrepared({ issues, fields: fieldSignature, entries });
    };
    let timer = window.setTimeout(prepareBatch, 0);
    return () => {
      canceled = true;
      window.clearTimeout(timer);
    };
  }, [issues, fields, fieldSignature, enabled]);

  const ready = enabled && prepared?.issues === issues && prepared.fields === fieldSignature;
  return { entries: ready ? prepared.entries : [], preparing: enabled && !ready };
}
