import { useEffect, useState } from 'react';
import { usePersistedWidth } from '@/hooks/usePersistedWidth';
import type { ProjectSort } from '../utils/projectSwitcher';

export const PROJECT_PICKER_WIDTH = { initial: 420, min: 300, max: 720 };

export function useProjectSwitcherPreferences(userId?: string) {
  const storageKey = `project-switcher:${userId ?? 'anonymous'}`;
  const { width, setWidth } = usePersistedWidth(
    `${storageKey}:width`,
    PROJECT_PICKER_WIDTH.initial,
    PROJECT_PICKER_WIDTH.min,
    PROJECT_PICKER_WIDTH.max,
  );
  const [sort, setStoredSort] = useState<ProjectSort>('key');

  useEffect(() => {
    try {
      const stored = localStorage.getItem(`${storageKey}:sort`);
      setStoredSort(
        stored === 'name' || stored === 'created' || stored === 'activity' ? stored : 'key',
      );
    } catch {
      setStoredSort('key');
    }
  }, [storageKey]);

  function setSort(next: ProjectSort) {
    setStoredSort(next);
    try {
      localStorage.setItem(`${storageKey}:sort`, next);
    } catch {
      // The preference still applies when browser storage is unavailable.
    }
  }

  return { width, setWidth, sort, setSort };
}
