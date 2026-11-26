import { useMemo } from 'react';
import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import { countIssuesByValue, type FilterValue } from '@/utils/filters';

// How many of the board's issues hold a value of a field, counted once per field
// for as long as the board is the same. Undefined while the board has no issues
// loaded, as on a screen that lists none.
export function useFilterCounts(project: ProjectDetail) {
  return useMemo(() => {
    const cache = new Map<string, Map<FilterValue, number>>();
    return (field: string, value: FilterValue): number | undefined => {
      if (project.issues.length === 0) return undefined;
      let counts = cache.get(field);
      if (!counts) {
        counts = countIssuesByValue(project.issues, field, project);
        cache.set(field, counts);
      }
      return counts.get(value) ?? 0;
    };
  }, [project]);
}
