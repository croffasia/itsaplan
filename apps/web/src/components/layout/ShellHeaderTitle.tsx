import { useTranslations } from 'next-intl';
import { SETTINGS_SECTIONS } from '@/utils/settingsSections';
import type { IssueRef } from '@/lib/api';
import type { ShellRoute } from '@/hooks/useShellRoute';
import { useSettingsSectionText } from '@/hooks/useSectionLabels';
import CycleBreadcrumb from '@/components/layout/CycleBreadcrumb';
import InitiativeBreadcrumb from '@/components/layout/InitiativeBreadcrumb';
import IssueBreadcrumb from '@/components/layout/IssueBreadcrumb';

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
  const t = useTranslations('nav');
  const sectionText = useSettingsSectionText();

  // The label on the pages that are not an issue, initiative or cycle detail. An
  // /ai-team route names its section.
  function pageLabel(): string {
    const { sub, section, aiTeamSection } = route;
    const known = (slug: string) => SETTINGS_SECTIONS.some((s) => s.slug === slug);
    if (section) return known(section) ? sectionText(section).label : t('projectSettings');
    if (sub === 'members') return t('members');
    if (sub === 'dashboard') return t('dashboards');
    if (sub === 'initiatives') return t('initiatives');
    if (sub === 'cycles') return t('cycles');
    if (aiTeamSection) return known(aiTeamSection) ? sectionText(aiTeamSection).label : t('aiTeam');
    if (sub === 'ai-agents') return t('aiAgents');
    if (sub === 'api') return t('api');
    return projectName;
  }

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
  return <>{pageLabel()}</>;
}
