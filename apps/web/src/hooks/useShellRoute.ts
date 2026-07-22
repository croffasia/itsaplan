import { useParams, usePathname } from 'next/navigation';
import { SETTINGS_SECTIONS } from '@/utils/settingsSections';

// The breadcrumb label for an /ai-team/:section route. The chat has no settings
// section entry; the rest take their label from the section config.
function aiTeamLabel(section: string | null): string | null {
  if (!section) return null;
  if (section === 'chat') return 'Chat with AI Team';
  return SETTINGS_SECTIONS.find((s) => s.slug === section)?.label ?? 'AI Team';
}

export type ShellRoute = {
  projectKey: string | null;
  // The segment after the project key: 'view', 'settings', 'issue', 'members', …
  // null on the project root.
  sub: string | null;
  activeViewId: number | null;
  section: string | null;
  aiTeamCrumb: string | null;
  // The project-scoped issue number from the URL, not the internal id.
  routeIssueSeq: number | null;
  routeInitiativeId: number | null;
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
    aiTeamCrumb: sub === 'ai-team' ? aiTeamLabel(segs[3] ?? null) : null,
    routeIssueSeq: sub === 'issue' && segs[3] ? Number(segs[3]) : null,
    routeInitiativeId: sub === 'initiatives' && segs[3] ? Number(segs[3]) : null,
    onBoard: sub == null || sub === 'view',
  };
}
