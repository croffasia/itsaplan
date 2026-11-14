import { useTranslations } from 'next-intl';
import type { FilterSection } from '@/components/common/filters/FilterMenu';

const WINDOWS = [1, 7, 30, 90] as const;
export const DEFAULT_DAYS = 30;

// The number of days back from now a dashboard reads, as a section of its filter.
export function usePeriodFilter(days: number): FilterSection {
  const t = useTranslations('agentAnalytics');
  return {
    key: 'period',
    label: t('period'),
    options: WINDOWS.map((window) => ({
      value: String(window),
      label: t('window', { days: window }),
    })),
    selected: [String(days)],
    defaultValue: String(DEFAULT_DAYS),
  };
}
