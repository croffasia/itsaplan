'use client';

import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface TakeoverSection {
  id: string;
  title: string;
  // Turns the heading into a link to the source of the section.
  href?: string;
  icon?: ReactNode;
  badge?: string;
  // What the section is to the reader: the one they are on, or one they have not
  // reached yet. Colors the index entry and the badge.
  tone?: 'current' | 'new';
  description?: ReactNode;
  body: ReactNode;
}

// A screen that takes the whole viewport for something the reader has to see before
// going back to the app: a rail carries the title, the index of the sections and the
// single action that closes it, the sections read in one column beside it. Below lg
// the rail becomes the header and the action moves to the end.
export default function TakeoverScreen({
  eyebrow,
  title,
  sections,
  navFooter,
  aside,
  actionLabel,
  onAction,
}: {
  eyebrow: string;
  title: string;
  sections: TakeoverSection[];
  // Closes the index, where the sections it does not carry are reached from.
  navFooter?: ReactNode;
  // Anything the screen offers besides reading: a re-check, a link out.
  aside?: ReactNode;
  actionLabel: string;
  onAction: () => void;
}) {
  if (typeof document === 'undefined') return null;
  // Portaled to the body: an opener inside a stacking context, like the sidebar
  // footer, would otherwise put the screen under page content of the same z-index.
  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background">
      <div className="grid min-h-full w-full lg:grid-cols-[20rem_minmax(0,1fr)] xl:grid-cols-[24rem_minmax(0,1fr)]">
        <aside className="flex flex-col gap-10 bg-muted/40 px-6 py-10 lg:sticky lg:top-0 lg:h-dvh lg:px-10 lg:py-14">
          <div>
            <p className="text-xs font-medium tracking-[0.12em] text-balance text-muted-foreground uppercase">
              {eyebrow}
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-balance lg:text-4xl">
              {title}
            </h1>
          </div>

          {sections.length > 1 && (
            <nav className="hidden lg:block">
              <ol className="space-y-2 text-sm">
                {sections.map((section, index) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      className={cn(
                        'flex gap-3 transition-colors',
                        section.tone === 'current'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      <span className="tabular-nums">{String(index + 1).padStart(2, '0')}</span>
                      <span>{section.title}</span>
                    </a>
                  </li>
                ))}
              </ol>
              {navFooter && <div className="mt-3 text-sm">{navFooter}</div>}
            </nav>
          )}

          {aside && <div className="mt-auto space-y-3 text-sm">{aside}</div>}

          <Button
            onClick={onAction}
            className={cn('hidden w-full lg:inline-flex', !aside && 'mt-auto')}
          >
            {actionLabel}
          </Button>
        </aside>

        <main className="flex w-full max-w-[80rem] min-w-0 flex-col px-6 py-10 lg:px-14 lg:py-14 xl:px-20">
          <div className="flex flex-col gap-14">
            {sections.map((section, index) => (
              <section
                key={section.id}
                id={section.id}
                className={index === 0 ? 'scroll-mt-8' : 'scroll-mt-8 border-t border-border pt-14'}
              >
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  {section.icon}
                  {section.href ? (
                    <a
                      href={section.href}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:underline"
                    >
                      {section.title}
                    </a>
                  ) : (
                    section.title
                  )}
                  {section.badge && (
                    <Badge
                      variant={section.tone === 'new' ? 'destructive' : 'secondary'}
                      className={cn(
                        section.tone === 'current' &&
                          'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
                      )}
                    >
                      {section.badge}
                    </Badge>
                  )}
                </h2>
                {section.description && (
                  <p className="mt-1 max-w-[68ch] text-sm text-muted-foreground">
                    {section.description}
                  </p>
                )}
                <div className="mt-5">{section.body}</div>
              </section>
            ))}
          </div>

          <Button onClick={onAction} className="mt-12 w-full sm:w-auto lg:hidden">
            {actionLabel}
          </Button>
        </main>
      </div>
    </div>,
    document.body,
  );
}
