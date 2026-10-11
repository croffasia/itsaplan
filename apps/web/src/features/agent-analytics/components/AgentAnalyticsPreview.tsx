'use client';

import { ChevronDown, ExternalLink, Lock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { usePersistedOpen } from '@/hooks/usePersistedOpen';
import { cn } from '@/lib/utils';
import { PRO_URL } from '@/utils/app';
import Panel from './Panel';

const PANELS = ['byPerson', 'byTrigger', 'bySchedule', 'tools', 'latency'] as const;

// Placeholder bar widths: what a panel's list looks like, holding no figure. They stay
// still, so they do not read as a panel that is loading.
const BARS = ['85%', '60%', '40%'];

// What the panels of the hosted build and Pro add to the dashboard, named and shown as
// empty shapes.
export default function AgentAnalyticsPreview() {
  const t = useTranslations('agentAnalytics.preview');
  const tCommon = useTranslations('common');
  const { open, toggle } = usePersistedOpen('agent-analytics-preview');

  return (
    <section className="space-y-4 rounded-xl border border-dashed p-5">
      <header className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <Lock className="size-4 shrink-0 text-muted-foreground" />
            {t('title')}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">{t('description')}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
          <Button variant="ghost" size="sm" asChild>
            <a href={PRO_URL} target="_blank" rel="noreferrer">
              {tCommon('aboutCloudAndPro')}
              <ExternalLink />
            </a>
          </Button>
          <Button variant="ghost" size="sm" aria-expanded={open} onClick={toggle}>
            {open ? t('hide') : t('show')}
            <ChevronDown
              className={cn('transition-transform duration-150', open && 'rotate-180')}
            />
          </Button>
        </div>
      </header>
      {open && (
        <div className="grid gap-4 xl:grid-cols-2">
          {PANELS.map((panel) => (
            <Panel
              key={panel}
              title={t(`${panel}.title`)}
              description={t(`${panel}.description`)}
              className="opacity-70"
            >
              <div className="space-y-2" aria-hidden>
                {BARS.map((width) => (
                  <div key={width} className="h-6 rounded-sm bg-muted" style={{ width }} />
                ))}
              </div>
            </Panel>
          ))}
        </div>
      )}
    </section>
  );
}
