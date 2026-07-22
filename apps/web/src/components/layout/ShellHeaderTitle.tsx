import { SETTINGS_SECTIONS } from '@/utils/settingsSections';
import type { ShellRoute } from '@/hooks/useShellRoute';
import InitiativeBreadcrumb from '@/components/layout/InitiativeBreadcrumb';
import IssueBreadcrumb from '@/components/layout/IssueBreadcrumb';

// The label on the pages that are not an issue or initiative detail.
function pageLabel(route: ShellRoute, projectName: string): string {
  const { sub, section, aiTeamCrumb } = route;
  if (section) return SETTINGS_SECTIONS.find((s) => s.slug === section)?.label ?? 'Settings';
  if (sub === 'members') return 'Members';
  if (sub === 'dashboard') return 'Dashboards';
  if (sub === 'initiatives') return 'Initiatives';
  if (aiTeamCrumb) return aiTeamCrumb;
  if (sub === 'ai-agents') return 'AI agents';
  if (sub === 'api') return 'API';
  return projectName;
}

// The header title: a breadcrumb on an issue or initiative page, otherwise the
// page's own label.
export default function ShellHeaderTitle({
  route,
  projectName,
  issueIdentifier,
}: {
  route: ShellRoute;
  projectName: string;
  issueIdentifier: string | null;
}) {
  if (route.routeIssueSeq != null) {
    return (
      <IssueBreadcrumb
        projectKey={route.projectKey}
        projectName={projectName}
        identifier={issueIdentifier}
      />
    );
  }
  if (route.routeInitiativeId != null) {
    return (
      <InitiativeBreadcrumb projectKey={route.projectKey} initiativeId={route.routeInitiativeId} />
    );
  }
  return <>{pageLabel(route, projectName)}</>;
}
