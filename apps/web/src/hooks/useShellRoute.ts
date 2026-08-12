import { useParams, usePathname } from 'next/navigation';

export type ShellRoute = {
  projectKey: string | null;
  // The segment after the project key: 'view', 'settings', 'issue', 'members', …
  // null on the project root.
  sub: string | null;
  activeViewId: number | null;
  section: string | null;
  // The /ai-team/:section segment, which the header names (see ShellHeaderTitle).
  aiTeamSection: string | null;
  // The project-scoped issue number from the URL, not the internal id.
  routeIssueSeq: number | null;
  routeInitiativeId: number | null;
  routeCycleId: number | null;
  // The work items routes, where the layout and selection commands apply.
  onBoard: boolean;
};

// The parts of the current route the Shell renders from. The open view, settings
// section and issue live in deeper segments than this layout, so they are read
// from the pathname rather than useParams.
export function useShellRoute(): ShellRoute {
  const params = useParams();
  const pathname = usePathname();

  const routeKey = params.projectKey;
  const projectKey = (Array.isArray(routeKey) ? routeKey[0] : routeKey) ?? null;

  const segs = pathname.split('/').filter(Boolean); // ['project', key, sub?, id?]
  const sub = segs[2] ?? null;

  return {
    projectKey,
    sub,
    activeViewId: sub === 'view' && segs[3] ? Number(segs[3]) : null,
    section: sub === 'settings' ? (segs[3] ?? null) : null,
    aiTeamSection: sub === 'ai-team' ? (segs[3] ?? null) : null,
    routeIssueSeq: sub === 'issue' && segs[3] ? Number(segs[3]) : null,
    // /initiatives/details/:id — the segment right after 'initiatives' is a list tab.
    routeInitiativeId:
      sub === 'initiatives' && segs[3] === 'details' && segs[4] ? Number(segs[4]) : null,
    // /cycles/details/:id — the segment right after 'cycles' is a list layout.
    routeCycleId: sub === 'cycles' && segs[3] === 'details' && segs[4] ? Number(segs[4]) : null,
    onBoard: sub == null || sub === 'view',
  };
}
