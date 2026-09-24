import { useParams, usePathname } from 'next/navigation';
import { parseIssueIdentifier, projectRefOf } from '@/utils/paths';

export type ShellRoute = {
  // The routed project's ref, "<teamRef>.<key>" — what the API takes as {projectKey}.
  projectKey: string | null;
  // The segment after the project key: 'view', 'settings', 'issue', 'members', …
  // null on the project root.
  sub: string | null;
  activeViewId: number | null;
  section: string | null;
  // The /agents/:section segment, which the header names (see ShellHeaderTitle).
  aiTeamSection: string | null;
  // The project-scoped issue number from the URL, not the internal id.
  routeIssueSeq: number | null;
  routeInitiativeId: number | null;
  routeCycleId: number | null;
  // The work items routes, where the layout and selection commands apply.
  onBoard: boolean;
};

const numericSegment = (value: string | undefined) =>
  value && /^\d+$/.test(value) ? Number(value) : null;

// The parts of the current route the Shell renders from. The open view, settings
// section and issue live in deeper segments than this layout, so they are read
// from the pathname rather than useParams. An issue is routed under its team
// (/acme/issue/MKT-42), so its project comes from the identifier.
export function useShellRoute(): ShellRoute {
  const params = useParams<{ teamRef?: string; projectKey?: string; identifier?: string }>();
  const pathname = usePathname();
  const teamRef = params.teamRef ? decodeURIComponent(params.teamRef) : null;

  const issue = params.identifier
    ? parseIssueIdentifier(decodeURIComponent(params.identifier))
    : null;
  const key = issue?.key ?? (params.projectKey ? decodeURIComponent(params.projectKey) : null);
  const projectKey = teamRef && key ? projectRefOf(teamRef, key) : null;

  const segs = pathname.split('/').filter(Boolean); // [team, key, sub?, id?, tab?]
  const sub = issue ? 'issue' : (segs[2] ?? null);

  return {
    projectKey,
    sub,
    activeViewId: sub === 'view' ? numericSegment(segs[3]) : null,
    section: sub === 'settings' ? (segs[3] ?? null) : null,
    aiTeamSection: sub === 'agents' ? (segs[3] ?? null) : null,
    routeIssueSeq: issue?.sequenceNumber ?? null,
    // The segment after 'initiatives' / 'cycles' is a list tab when it is a word
    // and a record when it is a number.
    routeInitiativeId: sub === 'initiatives' ? numericSegment(segs[3]) : null,
    routeCycleId: sub === 'cycles' ? numericSegment(segs[3]) : null,
    onBoard: sub == null || sub === 'view',
  };
}
