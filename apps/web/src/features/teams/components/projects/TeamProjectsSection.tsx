'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { projectPath } from '@/utils/paths';
import { useTeam, useTeamProjectsQuery } from '@/services/teams.service';
import SectionPageView from '@/components/common/page/SectionPageView';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import ListPager from '@/components/common/ListPager';
import SearchInput from '@/components/common/SearchInput';
import { usePaging } from '@/hooks/usePaging';
import { useSearchTerm } from '@/hooks/useSearchTerm';
import { Button } from '@/components/ui/button';
import NewProjectModal from '@/components/layout/NewProjectModal';
import TeamProjectPanel from './TeamProjectPanel';
import TeamProjectsTable from './TeamProjectsTable';

// The projects the team owns, one row each, opening in a side panel. Owners and
// managers run them, so only they create one; a plain member only reads them.
export default function TeamProjectsSection({ teamId }: { teamId: number }) {
  const t = useTranslations('teams');
  const router = useRouter();
  const team = useTeam(teamId);
  const paging = usePaging();
  const { search, setSearch, term } = useSearchTerm();
  const { data } = useTeamProjectsQuery(teamId, { search: term, ...paging.params });
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const canCreate = team != null && team.role !== 'member';
  const projects = data?.items ?? [];
  const total = data?.total ?? 0;
  const selected = projects.find((project) => project.id === selectedId) ?? null;

  function onSearchChange(next: string) {
    setSearch(next);
    paging.reset();
  }

  return (
    <SectionPageView
      title={t('sections.projects.title')}
      description={t('sections.projects.description')}
      wide
      actions={
        canCreate ? (
          <Button size="sm" className="h-8 gap-1.5" onClick={() => setCreating(true)}>
            <Plus className="size-3.5" />
            {t('panel.newProject')}
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-4">
        <div className="flex justify-end">
          <SearchInput
            value={search}
            onChange={onSearchChange}
            placeholder={t('panel.searchProjects')}
            className="w-60"
          />
        </div>

        {!data ? (
          <ListSkeleton rows={4} rowClassName="h-12" />
        ) : projects.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {term === undefined
              ? t('panel.noProjects')
              : t('panel.noProjectsMatch', { query: term })}
          </p>
        ) : (
          <TeamProjectsTable projects={projects} onSelect={setSelectedId} />
        )}
        {total > 0 && <ListPager paging={paging} total={total} />}
      </div>

      {creating && (
        <NewProjectModal
          teamId={teamId}
          onClose={() => setCreating(false)}
          onCreated={(key) => {
            setCreating(false);
            router.push(projectPath(key));
          }}
        />
      )}

      {selected && team && (
        <TeamProjectPanel
          teamId={teamId}
          teamName={team.name}
          teamRole={team.role}
          project={selected}
          onClose={() => setSelectedId(null)}
        />
      )}
    </SectionPageView>
  );
}
