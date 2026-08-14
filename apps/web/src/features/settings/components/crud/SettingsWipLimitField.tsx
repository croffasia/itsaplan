import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Gauge } from 'lucide-react';
import { type WipMode } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// A state's work-in-progress limit, edited behind a small trigger so the row keeps
// its shape. The mode only matters once a limit is set, so it appears with one.
export default function SettingsWipLimitField({
  limit,
  mode,
  onChange,
}: {
  limit: number | null;
  mode: WipMode;
  onChange: (limit: number | null, mode: WipMode) => void;
}) {
  const t = useTranslations('settings.states.wip');
  const [open, setOpen] = useState(false);

  // An empty or unparseable box clears the limit; the API rejects anything below 1.
  function changeLimit(raw: string) {
    const next = Number.parseInt(raw, 10);
    onChange(Number.isFinite(next) && next > 0 ? next : null, mode);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          title={t('label')}
          className={cn(
            'h-7 shrink-0 gap-1.5 px-2 text-muted-foreground',
            limit != null && 'text-foreground',
          )}
        >
          <Gauge className="size-4" />
          {limit != null && <span className="text-xs tabular-nums">{limit}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="wip-limit" className="text-xs">
            {t('label')}
          </Label>
          <Input
            id="wip-limit"
            type="number"
            min={1}
            value={limit ?? ''}
            placeholder={t('none')}
            onChange={(e) => changeLimit(e.target.value)}
            className="h-8"
          />
          <p className="text-xs text-muted-foreground">{t('help')}</p>
        </div>

        {limit != null && (
          <div className="space-y-1.5">
            <Label className="text-xs">{t('modeLabel')}</Label>
            <Select value={mode} onValueChange={(next) => onChange(limit, next as WipMode)}>
              <SelectTrigger className="h-8 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="soft">{t('softLabel')}</SelectItem>
                <SelectItem value="hard">{t('hardLabel')}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {mode === 'hard' ? t('hardHelp') : t('softHelp')}
            </p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
