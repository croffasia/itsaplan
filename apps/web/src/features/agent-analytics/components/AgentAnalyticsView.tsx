'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  useAgentAnalyticsQuery,
  type AgentAnalyticsScope,
} from '@/services/agentAnalytics.service';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import StatCards from './StatCards';
import ModelUsage from './ModelUsage';
import TokensByAgent from './TokensByAgent';
import TokensOverTime from './TokensOverTime';
import TraceVolume from './TraceVolume';
import Latency from './Latency';

// The dashboard itself, over whichever scope it was given: the whole team, or one
// project. Both scopes answer the same shape, so the panels are the same.
const WINDOWS = [1, 7, 30, 90] as const;

export default function AgentAnalyticsView({ scope }: { scope: AgentAnalyticsScope }) {
  const t = useTranslations('agentAnalytics');
  const [days, setDays] = useState<number>(30);
  const { data, isLoading } = useAgentAnalyticsQuery(scope, days);

  return (
    <div className="space-y-6">
      <Select value={String(days)} onValueChange={(value) => setDays(Number(value))}>
        <SelectTrigger className="w-40" size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {WINDOWS.map((window) => (
            <SelectItem key={window} value={String(window)}>
              {t('window', { days: window })}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {isLoading || !data ? (
        <div className="space-y-6">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <>
          <StatCards data={data} />
          <div className="grid gap-4 xl:grid-cols-3">
            <ModelUsage data={data} />
            <TokensByAgent data={data} />
            <TokensOverTime data={data} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <TraceVolume data={data} />
            <Latency data={data} />
          </div>
        </>
      )}
    </div>
  );
}
