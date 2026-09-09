'use client';

import { Bot } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { formatShortDate } from '@/utils/dates';
import { useSearchTerm } from '@/hooks/useSearchTerm';
import Avatar from '@/components/common/Avatar';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import { EmptyState } from '@/components/common/page/EmptyState';
import SearchInput from '@/components/common/SearchInput';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useInstanceTeamMembersQuery } from '../../services/god.service';

// Everyone in the team, people and agents alike, a page at a time. The rank is the
// fixed team one, so there is no permission matrix to unfold behind the row.
export default function GodTeamMembers({ teamId }: { teamId: number }) {
  const t = useTranslations('god.teamPanel');
  const tCommon = useTranslations('common');
  const { search, setSearch, term } = useSearchTerm();

  const membersQuery = useInstanceTeamMembersQuery(teamId, term);
  const members = membersQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const total = membersQuery.data?.pages[0]?.total ?? 0;

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-medium">{t('members')}</h3>
        {total > 0 && <span className="text-xs text-muted-foreground">{total}</span>}
      </div>

      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder={t('searchMembers')}
        className="w-full"
      />

      {membersQuery.isPending ? (
        <ListSkeleton rows={4} rowClassName="h-12" />
      ) : members.length === 0 ? (
        <EmptyState
          title={t('noMembersTitle')}
          description={term ? t('noMemberMatches') : t('noMembersHint')}
        />
      ) : (
        <>
          <div className="space-y-2">
            {members.map((m) => (
              <div
                key={m.userId}
                className="flex items-center gap-2.5 rounded-lg bg-muted/40 px-3 py-2.5"
              >
                <Avatar
                  name={m.name || m.email}
                  image={m.image}
                  className="size-8 shrink-0 text-[11px]"
                />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm">{m.name || m.email}</span>
                  <span className="truncate text-xs text-muted-foreground">{m.email}</span>
                </div>
                <Badge
                  variant={m.role === 'owner' ? 'default' : 'secondary'}
                  className="gap-1 px-1.5 py-0 text-[10px] font-medium"
                >
                  {m.isAgent && <Bot className="size-3" />}
                  {t(`roles.${m.role}`)}
                </Badge>
                <span className="hidden text-xs text-muted-foreground sm:inline">
                  {t('joined', { date: formatShortDate(m.joinedAt) })}
                </span>
              </div>
            ))}
          </div>
          {membersQuery.hasNextPage && (
            <Button
              variant="outline"
              className="w-full"
              disabled={membersQuery.isFetchingNextPage}
              onClick={() => void membersQuery.fetchNextPage()}
            >
              {tCommon('showMore')}
            </Button>
          )}
        </>
      )}
    </section>
  );
}
