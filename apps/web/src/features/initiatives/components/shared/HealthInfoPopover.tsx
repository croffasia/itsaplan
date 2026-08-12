import { Fragment } from 'react';
import { ChevronRight, HelpCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { InitiativeHealth } from '@/lib/api';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { healthColor } from '@/utils/initiativeMeta';

// The health values explained in the info popover, in severity order. null is the
// value with nothing to judge yet, and is keyed as `unknown` in the messages.
const HEALTH_LEGEND: (InitiativeHealth | 'unknown')[] = [
  'on_track',
  'at_risk',
  'off_track',
  'unknown',
];

// A "?" trigger explaining what the health signal means, how it is graded, and
// the formula behind it. Shown next to the health badge in the detail header and
// the timeline card.
export default function HealthInfoPopover() {
  const t = useTranslations('initiatives.healthInfo');
  const tHealth = useTranslations('initiatives.health');
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t('trigger')}
          className="text-muted-foreground/60 hover:text-foreground"
        >
          <HelpCircle className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0 text-sm">
        <div className="px-3.5 py-3">
          <p className="font-medium">{t('title')}</p>
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{t('description')}</p>
        </div>
        <div className="grid grid-cols-[auto_1fr] gap-x-2.5 gap-y-3 border-t border-border px-3.5 py-3">
          {HEALTH_LEGEND.map((key) => (
            <Fragment key={key}>
              <span
                className="mt-1.5 size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: healthColor(key === 'unknown' ? null : key) }}
              />
              <div>
                <p className="font-medium">{tHealth(key)}</p>
                <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                  {t(`legend.${key}`)}
                </p>
              </div>
            </Fragment>
          ))}
        </div>
        <Collapsible className="border-t border-border">
          <CollapsibleTrigger className="group/calc flex w-full items-center justify-between px-3.5 py-2.5 text-xs font-medium text-muted-foreground">
            <span className="transition-colors group-hover/calc:text-foreground">
              {t('howCalculated')}
            </span>
            <ChevronRight className="size-3.5 shrink-0 transition group-data-[state=open]/calc:rotate-90" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-2 px-3.5 pb-3 text-xs">
              <div>
                <p className="text-muted-foreground">{t('workDone')}</p>
                <p className="font-mono">completed / (total - canceled)</p>
              </div>
              <div>
                <p className="text-muted-foreground">{t('timeElapsed')}</p>
                <p className="font-mono">(now - start) / (target - start)</p>
              </div>
              <div>
                <p className="text-muted-foreground">{t('trail')}</p>
                <div className="mt-0.5 grid grid-cols-[1fr_auto] gap-x-3 font-mono">
                  <span>{tHealth('on_track')}</span>
                  <span>{t('trailOnTrack')}</span>
                  <span>{tHealth('at_risk')}</span>
                  <span>{t('trailAtRisk')}</span>
                  <span>{tHealth('off_track')}</span>
                  <span>{t('trailOffTrack')}</span>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </PopoverContent>
    </Popover>
  );
}
