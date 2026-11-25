import { CircleSlash } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// Whether a state is the project's blocked column. Turning it on takes the flag from
// the state that had it.
export default function SettingsBlockedColumnField({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  const t = useTranslations('settings.states.blocked');
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-pressed={value}
          aria-label={t('label')}
          className={cn(
            'h-7 shrink-0 px-2 text-muted-foreground',
            value && 'bg-accent text-foreground',
          )}
          onClick={() => onChange(!value)}
        >
          <CircleSlash className="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">{t('help')}</TooltipContent>
    </Tooltip>
  );
}
