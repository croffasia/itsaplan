import { useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import type { ResourcePermissions } from '@/lib/api/endpoints/roles';
import type { AgentSkill } from '@/lib/api/endpoints/agentSkills';
import { useSkillsPageQuery, useDeleteSkill } from '@/services/agentSkills.service';
import { EmptyState } from '@/components/common/page/EmptyState';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import ConfirmDialog from '@/components/common/overlay/ConfirmDialog';
import ListPager from '@/components/common/ListPager';
import { usePaging } from '@/hooks/usePaging';
import { useSearchTerm } from '@/hooks/useSearchTerm';
import TeamListToolbar from '../TeamListToolbar';
import { SkillEditDialog } from './SkillEditDialog';
import { SkillRow } from './SkillRow';
import { SkillTable } from './SkillTable';

const SOURCES: AgentSkill['source'][] = ['github', 'upload', 'inline'];

// The team's skill library as a table: reusable instructions the internal agents of
// its projects load on demand. A skill is a SKILL.md plus optional reference files;
// it can be written inline, uploaded, or imported from GitHub. Editing opens a separate
// dialog that also manages the reference files.
export default function TeamAgentSkills({
  teamId,
  teamName,
  permissions,
}: {
  teamId: number;
  teamName: string;
  permissions: ResourcePermissions;
}) {
  const t = useTranslations('teams.skills');
  const [editing, setEditing] = useState<AgentSkill | null>(null);
  const [deleting, setDeleting] = useState<AgentSkill | null>(null);
  const paging = usePaging();
  const { search, setSearch, term } = useSearchTerm();
  const [sourceFilter, setSourceFilter] = useState<AgentSkill['source'][]>([]);

  const skillsQuery = useSkillsPageQuery(teamId, {
    search: term,
    sources: sourceFilter.length > 0 ? sourceFilter : undefined,
    ...paging.params,
  });
  const skills = skillsQuery.data?.items ?? [];
  const total = skillsQuery.data?.total ?? 0;
  const deleteSkill = useDeleteSkill(teamId);

  function onSearchChange(next: string) {
    setSearch(next);
    paging.reset();
  }

  function onSourceFilterChange(_key: string, next: string[]) {
    setSourceFilter(SOURCES.filter((source) => next.includes(source)));
    paging.reset();
  }

  let list: ReactNode;
  if (skillsQuery.isPending) {
    list = <ListSkeleton rows={3} rowClassName="h-12" />;
  } else if (total === 0 && term === undefined && sourceFilter.length === 0) {
    list = <EmptyState title={t('empty')} description={t('emptyHint')} />;
  } else {
    list = (
      <div className="space-y-4">
        <TeamListToolbar
          search={search}
          onSearchChange={onSearchChange}
          placeholder={t('searchPlaceholder')}
          sections={[
            {
              key: 'source',
              label: t('sourceFilter'),
              options: SOURCES.map((source) => ({ value: source, label: t(`source.${source}`) })),
              selected: sourceFilter,
            },
          ]}
          onFilterChange={onSourceFilterChange}
        />
        {total === 0 ? (
          <p className="text-sm text-muted-foreground">
            {term !== undefined ? t('noMatches', { query: term }) : t('noSourceMatches')}
          </p>
        ) : (
          <>
            <SkillTable>
              {skills.map((skill) => (
                <SkillRow
                  key={skill.id}
                  skill={skill}
                  canEdit={permissions.edit}
                  canDelete={permissions.delete}
                  onEdit={() => setEditing(skill)}
                  onDelete={() => setDeleting(skill)}
                />
              ))}
            </SkillTable>
            <ListPager paging={paging} total={total} />
          </>
        )}
      </div>
    );
  }

  return (
    <>
      {list}

      {editing && (
        <SkillEditDialog
          teamId={teamId}
          teamName={teamName}
          skill={editing}
          canEdit={permissions.edit}
          onClose={() => setEditing(null)}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title={t('deleteTitle')}
          confirmLabel={t('delete')}
          onConfirm={async () => {
            await deleteSkill.mutateAsync(deleting.id);
            setDeleting(null);
          }}
          onClose={() => setDeleting(null)}
        >
          <div className="text-sm text-muted-foreground">
            {t('deleteMessage', { name: deleting.name })}
          </div>
        </ConfirmDialog>
      )}
    </>
  );
}
