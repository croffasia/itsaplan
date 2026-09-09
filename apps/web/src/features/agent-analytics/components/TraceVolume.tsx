import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { AgentAnalytics } from '@/lib/api/endpoints/agentAnalytics';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Panel from './Panel';
import BarList, { type BarRow } from './BarList';
import { formatCount } from '../utils/format';

// How much the agents ran, read from either side of a run: the runs themselves, or
// the tool calls they made. The failed part of each bar is in the error colour.
type Subject = 'agents' | 'tools';

export default function TraceVolume({ data }: { data: AgentAnalytics }) {
  const t = useTranslations('agentAnalytics');
  const [subject, setSubject] = useState<Subject>('agents');

  const rows: BarRow[] =
    subject === 'agents'
      ? data.agents.map((agent) => ({
          key: String(agent.agentId),
          label: agent.name || t('deletedAgent'),
          value: agent.runs,
          split: agent.errors,
        }))
      : data.tools.map((tool) => ({
          key: tool.name,
          label: tool.name,
          value: tool.calls,
          split: tool.errors,
        }));

  const total = subject === 'agents' ? data.totals.runs : data.totals.toolCalls;

  return (
    <Panel
      title={t('volume.title')}
      description={t('volume.description')}
      value={formatCount(total)}
      valueLabel={subject === 'agents' ? t('volume.totalRuns') : t('volume.totalCalls')}
    >
      <div className="space-y-3">
        <Tabs value={subject} onValueChange={(next) => setSubject(next as Subject)}>
          <TabsList variant="line">
            <TabsTrigger value="agents">{t('volume.agents')}</TabsTrigger>
            <TabsTrigger value="tools">{t('volume.tools')}</TabsTrigger>
          </TabsList>
        </Tabs>
        <BarList
          rows={rows}
          empty={subject === 'agents' ? t('volume.emptyAgents') : t('volume.emptyTools')}
          splitLabel={t('volume.errors')}
        />
      </div>
    </Panel>
  );
}
