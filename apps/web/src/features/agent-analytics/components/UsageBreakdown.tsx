import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { AgentUsage } from '@/lib/api/endpoints/agentAnalytics';
import Panel from './Panel';
import BarList from './BarList';
import MeasureTabs, { type Measure } from './MeasureTabs';
import { formatCost, formatCount } from '../utils/format';

export interface UsageItem extends AgentUsage {
  key: string;
  label: string;
}

// What each item of the window used, largest first, read as tokens or as what they
// cost. An item whose models are unpriced drops out of the cost list rather than
// reading as zero.
export default function UsageBreakdown({
  title,
  description,
  empty,
  items,
  total,
  onSelect,
}: {
  title: string;
  description: string;
  empty: string;
  items: UsageItem[];
  total: AgentUsage;
  onSelect?: (key: string) => void;
}) {
  const t = useTranslations('agentAnalytics');
  const [measure, setMeasure] = useState<Measure>('tokens');
  const tokensOf = (usage: AgentUsage) => usage.inputTokens + usage.outputTokens;

  const rows =
    measure === 'tokens'
      ? items.map((item) => ({
          ...item,
          value: tokensOf(item),
          trailing: formatCount(tokensOf(item)),
        }))
      : items
          .filter((item) => item.cost != null)
          .map((item) => ({ ...item, value: item.cost ?? 0, trailing: formatCost(item.cost) }))
          .sort((a, b) => b.value - a.value);

  return (
    <Panel
      title={title}
      description={description}
      value={measure === 'tokens' ? formatCount(tokensOf(total)) : formatCost(total.cost)}
      valueLabel={measure === 'tokens' ? t('totalTokens') : t('totalCost')}
    >
      <div className="space-y-3">
        <MeasureTabs value={measure} onChange={setMeasure} />
        <BarList rows={rows} empty={empty} onSelect={onSelect} />
      </div>
    </Panel>
  );
}
