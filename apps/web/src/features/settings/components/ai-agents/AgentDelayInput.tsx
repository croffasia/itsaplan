import { Input } from '@/components/ui/input';
import { useTranslations } from 'next-intl';

// How long a triggered run waits before the agent may pick it up, in minutes. Both
// the delegation trigger and each field trigger carry one.
export function AgentDelayInput({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const t = useTranslations('settings.agents');
  return (
    <div className="flex items-center justify-between gap-2 border-s ps-3">
      <span>
        <label htmlFor={id} className="text-sm">
          {t('runDelay')}
        </label>
        <span className="block text-xs text-muted-foreground">{t('runDelayHint')}</span>
      </span>
      <div className="flex shrink-0 items-center gap-2">
        <Input
          id={id}
          type="number"
          step="1"
          min="0"
          max="1440"
          className="w-20"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <span className="text-xs text-muted-foreground">{t('minutes')}</span>
      </div>
    </div>
  );
}
