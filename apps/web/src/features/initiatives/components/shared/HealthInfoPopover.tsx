import { Fragment } from 'react';
import { ChevronRight, HelpCircle } from 'lucide-react';
import type { InitiativeHealth } from '@/lib/api';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { healthMeta } from './initiativeMeta';

// The health values explained in the info popover, in severity order.
const HEALTH_LEGEND: { health: InitiativeHealth | null; desc: string }[] = [
  { health: 'on_track', desc: 'Work is keeping pace with the schedule.' },
  { health: 'at_risk', desc: 'Work is slipping behind the schedule.' },
  { health: 'off_track', desc: 'Work is well behind, or the target date has passed.' },
  { health: null, desc: 'Not enough data yet: no issues or no target date.' },
];

// A "?" trigger explaining what the health signal means, how it is graded, and
// the formula behind it. Shown next to the health badge in the detail header and
// the timeline card.
export default function HealthInfoPopover() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="How is health calculated?"
          className="text-muted-foreground/60 hover:text-foreground"
        >
          <HelpCircle className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0 text-sm">
        <div className="px-3.5 py-3">
          <p className="font-medium">Health</p>
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
            Compares work done against time elapsed. Updates automatically.
          </p>
        </div>
        <div className="grid grid-cols-[auto_1fr] gap-x-2.5 gap-y-3 border-t border-border px-3.5 py-3">
          {HEALTH_LEGEND.map(({ health, desc }) => {
            const { label, color } = healthMeta(health);
            return (
              <Fragment key={label}>
                <span
                  className="mt-1.5 size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <div>
                  <p className="font-medium">{label}</p>
                  <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{desc}</p>
                </div>
              </Fragment>
            );
          })}
        </div>
        <Collapsible className="border-t border-border">
          <CollapsibleTrigger className="group/calc flex w-full items-center justify-between px-3.5 py-2.5 text-xs font-medium text-muted-foreground">
            <span className="transition-colors group-hover/calc:text-foreground">
              How it&apos;s calculated
            </span>
            <ChevronRight className="size-3.5 shrink-0 transition group-data-[state=open]/calc:rotate-90" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-2 px-3.5 pb-3 text-xs">
              <div>
                <p className="text-muted-foreground">Work done</p>
                <p className="font-mono">completed / (total - canceled)</p>
              </div>
              <div>
                <p className="text-muted-foreground">Time elapsed</p>
                <p className="font-mono">(now - start) / (target - start)</p>
              </div>
              <div>
                <p className="text-muted-foreground">How far work trails time</p>
                <div className="mt-0.5 grid grid-cols-[1fr_auto] gap-x-3 font-mono">
                  <span>On track</span>
                  <span>up to 10% behind</span>
                  <span>At risk</span>
                  <span>10-25% behind</span>
                  <span>Off track</span>
                  <span>over 25% behind</span>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </PopoverContent>
    </Popover>
  );
}
