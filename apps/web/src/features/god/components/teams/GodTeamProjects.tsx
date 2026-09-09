'use client';

import { useTranslations } from 'next-intl';
import { useSearchTerm } from '@/hooks/useSearchTerm';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import { EmptyState } from '@/components/common/page/EmptyState';
import SearchInput from '@/components/common/SearchInput';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useInstanceTeamProjectsQuery } from '../../services/god.service';
import { compactCount } from '../../utils/numbers';

// The projects a team owns, a page at a time. The search runs on the server, so it
// reaches the projects the loaded pages do not hold.
export default function GodTeamProjects({ teamId }: { teamId: number }) {
  const t = useTranslations('god.teamPanel');
  const tCommon = useTranslations('common');
  const { search, setSearch, term } = useSearchTerm();

  const projectsQuery = useInstanceTeamProjectsQuery(teamId, term);
  const projects = projectsQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const total = projectsQuery.data?.pages[0]?.total ?? 0;

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-medium">{t('projects')}</h3>
        {total > 0 && <span className="text-xs text-muted-foreground">{total}</span>}
      </div>

      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder={t('searchProjects')}
        className="w-full"
      />

      {projectsQuery.isPending ? (
        <ListSkeleton rows={4} rowClassName="h-12" />
      ) : projects.length === 0 ? (
        <EmptyState
          title={t('noProjectsTitle')}
          description={term ? t('noProjectMatches') : t('noProjectsHint')}
        />
      ) : (
        <>
          <div className="space-y-2">
            {projects.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/40 px-3 py-2.5"
              >
                <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 text-xs font-medium text-secondary-foreground">
                  {p.key}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">{p.name}</span>
                <Badge
                  variant={p.mcpEnabled ? 'secondary' : 'outline'}
                  className="px-1.5 py-0 text-[10px] font-medium"
                >
                  {t(p.mcpEnabled ? 'mcpEnabled' : 'mcpOff')}
                </Badge>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {t('projectCounts', {
                    issues: compactCount(p.issueCount),
                    members: compactCount(p.memberCount),
                  })}
                </span>
              </div>
            ))}
          </div>
          {projectsQuery.hasNextPage && (
            <Button
              variant="outline"
              className="w-full"
              disabled={projectsQuery.isFetchingNextPage}
              onClick={() => void projectsQuery.fetchNextPage()}
            >
              {tCommon('showMore')}
            </Button>
          )}
        </>
      )}
    </section>
  );
}
