import { useTranslations } from 'next-intl';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const WINDOWS = [1, 7, 30, 90] as const;

// The number of days back from now a dashboard reads.
export default function WindowSelect({
  value,
  onChange,
}: {
  value: number;
  onChange: (days: number) => void;
}) {
  const t = useTranslations('agentAnalytics');
  return (
    <Select value={String(value)} onValueChange={(next) => onChange(Number(next))}>
      <SelectTrigger className="w-40" size="sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {WINDOWS.map((days) => (
          <SelectItem key={days} value={String(days)}>
            {t('window', { days })}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
