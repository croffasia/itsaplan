'use client';

import { useParams } from 'next/navigation';
import LegacyRedirect from '@/components/common/LegacyRedirect';
import { issuePath, projectPath } from '@/utils/paths';

// The project paths from before keys were unique per team, /project/MKT/…, moved to
// /acme/MKT/…, with the segments renamed on the way.
function movedSegments(rest: string[]): string[] {
  const [first, ...after] = rest;
  switch (first) {
    case 'dashboard':
      return ['dashboards', ...after];
    case 'ai-agents':
      return ['agents'];
    case 'ai-team':
      return ['agents', ...after];
    case 'cycles':
    case 'initiatives':
      return after[0] === 'details' ? [first, ...after.slice(1)] : rest;
    default:
      return rest;
  }
}

export default function Page() {
  const { projectKey, rest = [] } = useParams<{ projectKey: string; rest?: string[] }>();
  const key = decodeURIComponent(projectKey);

  return (
    <LegacyRedirect
      resolve={(projects) => {
        const matches = projects.filter((project) => project.key === key);
        if (matches.length !== 1) return null;
        const { ref } = matches[0];
        if (rest[0] === 'issue' && /^\d+$/.test(rest[1] ?? ''))
          return issuePath(ref, Number(rest[1]));
        return [projectPath(ref), ...movedSegments(rest)].join('/');
      }}
    />
  );
}
