import { useTranslations } from 'next-intl';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const LIMIT_OPTIONS = [10, 20, 50];

// Row-count picker shared by the list widgets' settings popovers.
export default function LimitSelect({
  value,
  onChange,
}: {
  value: number;
  onChange: (limit: number) => void;
}) {
  const t = useTranslations('dashboards');
  return (
    <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger size="sm" className="w-[110px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {LIMIT_OPTIONS.map((n) => (
          <SelectItem key={n} value={String(n)}>
            {t('showRows', { count: n })}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
