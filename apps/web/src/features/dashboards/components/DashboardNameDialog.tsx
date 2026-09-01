import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { DashboardPreset } from '@/utils/dashboardWidgets';

// A small name prompt used for both create and rename.
export default function DashboardNameDialog({
  open,
  title,
  initial,
  showPresets,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  initial: string;
  showPresets: boolean;
  onClose: () => void;
  onSubmit: (name: string, preset: DashboardPreset) => void;
}) {
  const t = useTranslations('dashboards');
  const tCommon = useTranslations('common');
  const [name, setName] = useState(initial);
  const [preset, setPreset] = useState<DashboardPreset>('overview');
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const trimmed = name.trim();
            if (trimmed) onSubmit(trimmed, preset);
          }}
        >
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('namePlaceholder')}
          />
          {showPresets && (
            <div className="mt-4 space-y-2">
              <p className="text-sm font-medium">{t('template')}</p>
              <div className="grid grid-cols-2 gap-2">
                {(['overview', 'myFocus'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={preset === value}
                    onClick={() => {
                      const currentDefault =
                        preset === 'myFocus' ? t('myFocusName') : t('defaultName');
                      setPreset(value);
                      if (!name.trim() || name === currentDefault)
                        setName(value === 'myFocus' ? t('myFocusName') : t('defaultName'));
                    }}
                    className={cn(
                      'rounded-md border px-3 py-2 text-start text-sm hover:bg-accent',
                      preset === value && 'border-primary bg-accent',
                    )}
                  >
                    {value === 'myFocus' ? t('myFocusName') : t('defaultName')}
                  </button>
                ))}
              </div>
            </div>
          )}
          <DialogFooter className="mt-4">
            <Button type="button" variant="ghost" onClick={onClose}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              {tCommon('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
