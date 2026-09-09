import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { AgentAnalytics } from '@/lib/api/endpoints/agentAnalytics';
import Panel from './Panel';
import BarList, { type BarRow } from './BarList';
import MeasureTabs, { type Measure } from './MeasureTabs';
import { formatCost, formatCount } from '../utils/format';

// What each agent of the scope used over the window, largest first. Read as tokens or
// as the amount they cost; an agent whose models are unpriced drops out of the cost
// list rather than reading as zero.
export default function TokensByAgent({ data }: { data: AgentAnalytics }) {
  const t = useTranslations('agentAnalytics');
  const [measure, setMeasure] = useState<Measure>('tokens');
  const tokens = data.totals.inputTokens + data.totals.outputTokens;

  const rows: BarRow[] =
    measure === 'tokens'
      ? data.agents.map((agent) => ({
          key: String(agent.agentId),
          label: agent.name || t('deletedAgent'),
          value: agent.inputTokens + agent.outputTokens,
        }))
      : data.agents
          .filter((agent) => agent.cost != null)
          .map((agent) => ({
            key: String(agent.agentId),
            label: agent.name || t('deletedAgent'),
            value: agent.cost ?? 0,
            trailing: formatCost(agent.cost),
          }));

  return (
    <Panel
      title={t('byAgent.title')}
      description={t('byAgent.description')}
      value={measure === 'tokens' ? formatCount(tokens) : formatCost(data.totals.cost)}
      valueLabel={measure === 'tokens' ? t('byAgent.totalTokens') : t('models.totalCost')}
    >
      <div className="space-y-3">
        <MeasureTabs value={measure} onChange={setMeasure} />
        <BarList rows={rows} empty={t('byAgent.empty')} />
      </div>
    </Panel>
  );
}
