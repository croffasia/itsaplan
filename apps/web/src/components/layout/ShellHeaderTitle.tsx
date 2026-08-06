import { SETTINGS_SECTIONS } from '@/utils/settingsSections';
import type { IssueRef } from '@/lib/api';
import type { ShellRoute } from '@/hooks/useShellRoute';
import CycleBreadcrumb from '@/components/layout/CycleBreadcrumb';
import InitiativeBreadcrumb from '@/components/layout/InitiativeBreadcrumb';
import IssueBreadcrumb from '@/components/layout/IssueBreadcrumb';

// The label on the pages that are not an issue, initiative or cycle detail.
function pageLabel(route: ShellRoute, projectName: string): string {
  const { sub, section, aiTeamCrumb } = route;
  if (section) return SETTINGS_SECTIONS.find((s) => s.slug === section)?.label ?? 'Settings';
  if (sub === 'members') return 'Members';
  if (sub === 'dashboard') return 'Dashboards';
  if (sub === 'initiatives') return 'Initiatives';
  if (sub === 'cycles') return 'Cycles';
  if (aiTeamCrumb) return aiTeamCrumb;
  if (sub === 'ai-agents') return 'AI agents';
  if (sub === 'api') return 'API';
  return projectName;
}

// The header title: a breadcrumb on an issue, initiative or cycle page, otherwise
// the page's own label.
export default function ShellHeaderTitle({
  route,
  projectName,
  issueIdentifier,
  issueParent,
}: {
  route: ShellRoute;
  projectName: string;
  issueIdentifier: string | null;
  issueParent: IssueRef | null;
}) {
  if (route.routeIssueSeq != null) {
    return (
      <IssueBreadcrumb
        projectKey={route.projectKey}
        projectName={projectName}
        identifier={issueIdentifier}
        parent={issueParent}
      />
    );
  }
  if (route.routeInitiativeId != null) {
    return (
      <InitiativeBreadcrumb projectKey={route.projectKey} initiativeId={route.routeInitiativeId} />
    );
  }
  if (route.routeCycleId != null) {
    return <CycleBreadcrumb projectKey={route.projectKey} cycleId={route.routeCycleId} />;
  }
  return <>{pageLabel(route, projectName)}</>;
}
