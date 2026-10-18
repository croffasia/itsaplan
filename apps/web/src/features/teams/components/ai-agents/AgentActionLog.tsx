'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAgentActionsQuery } from '@/services/agentActions.service';
import { usePaging } from '@/hooks/usePaging';
import { useRelativeTime } from '@/context/relativeTimeContext';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import ListPager from '@/components/common/ListPager';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import { useAgentSection } from '../../context/agentSection';

// A picked day is read in the viewer's time zone; `to` takes the whole day it names.
function dayStart(value: string, offsetDays = 0): string | undefined {
  if (!value) return undefined;
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString();
}

// The write calls an agent made, newest first, a page at a time.
export function AgentActionLog({ agentId }: { agentId: number }) {
  const t = useTranslations('teams.agentActions');
  const relativeTime = useRelativeTime();
  const paging = usePaging();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const query = useAgentActionsQuery(useAgentSection().teamId, agentId, paging.params, {
    from: dayStart(from),
    to: dayStart(to, 1),
  });

  const pickDay = (set: (value: string) => void) => (event: { target: { value: string } }) => {
    set(event.target.value);
    paging.reset();
  };

  const page = query.data;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b px-4 py-2 text-xs">
        <label className="flex items-center gap-1.5">
          {t('from')}
          <Input type="date" className="h-8 w-auto" value={from} onChange={pickDay(setFrom)} />
        </label>
        <label className="flex items-center gap-1.5">
          {t('to')}
          <Input type="date" className="h-8 w-auto" value={to} onChange={pickDay(setTo)} />
        </label>
      </div>
      {query.isLoading ? (
        <ListSkeleton rows={4} className="p-4" rowClassName="h-10" />
      ) : !page || page.total === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">{t('noActions')}</p>
      ) : (
        <>
          <div className="min-h-0 flex-1 divide-y divide-border/50 overflow-y-auto">
            {page.items.map((item) => (
              <div key={item.id} className="flex flex-col gap-1 px-4 py-2.5 text-xs">
                <div className="flex items-center gap-2">
                  <code className="shrink-0">{item.tool}</code>
                  {item.status === 'failed' && (
                    <Badge variant="destructive">{t('status.failed')}</Badge>
                  )}
                  {item.issueKey && (
                    <>
                      <span className="shrink-0 font-medium">{item.issueKey}</span>
                      <span className="truncate" dir="auto">
                        {item.issueTitle}
                      </span>
                    </>
                  )}
                  {item.runId != null && (
                    <span className="shrink-0 text-muted-foreground">
                      {t('run', { id: item.runId })}
                    </span>
                  )}
                  <span className="ms-auto shrink-0 text-muted-foreground">
                    {relativeTime(item.createdAt)}
                  </span>
                </div>
                {item.approvedByName && (
                  <span className="text-muted-foreground">
                    {t('approvedBy', { name: item.approvedByName })}
                  </span>
                )}
                {item.error && (
                  <span className="line-clamp-2 break-all text-destructive">{item.error}</span>
                )}
              </div>
            ))}
          </div>
          <div className="border-t p-3">
            <ListPager paging={paging} total={page.total} />
          </div>
        </>
      )}
    </div>
  );
}
