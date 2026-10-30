'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { teamSectionPath } from '@/utils/paths';
import { useTeam } from '@/services/teams.service';
import { useProjectTemplatesQuery } from '@/services/projectTemplates.service';
import { EmptyState } from '@/components/common/page/EmptyState';
import SectionPageView from '@/components/common/page/SectionPageView';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import { Button } from '@/components/ui/button';
import TeamTemplatesTable from './TeamTemplatesTable';

// The project templates of a team, which its owners and managers save from a project's
// row in Projects and pick when they create a project. A plain member reads a notice
// instead of the list.
export default function TeamTemplatesSection({ teamId }: { teamId: number }) {
  const t = useTranslations('teams');
  const team = useTeam(teamId);
  const canManage = team?.role === 'owner' || team?.role === 'manager';
  const { data: templates } = useProjectTemplatesQuery(canManage ? teamId : null);

  return (
    <SectionPageView
      title={t('sections.templates.title')}
      description={t('sections.templates.description')}
      wide
    >
      {!team ? (
        <ListSkeleton rows={2} rowClassName="h-12" />
      ) : !canManage ? (
        <p className="text-sm text-muted-foreground">{t('templates.ownerOnly')}</p>
      ) : !templates ? (
        <ListSkeleton rows={2} rowClassName="h-12" />
      ) : templates.length === 0 ? (
        <EmptyState title={t('templates.empty')} description={t('templates.emptyHint')}>
          <Button asChild size="sm" variant="outline">
            <Link href={teamSectionPath(team.ref, 'projects')}>{t('templates.openProjects')}</Link>
          </Button>
        </EmptyState>
      ) : (
        <TeamTemplatesTable teamId={teamId} templates={templates} />
      )}
    </SectionPageView>
  );
}
