import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { FeedItem } from '@/lib/api/endpoints/activity';
import { cn } from '@/lib/utils';
import ActivityLine from './ActivityLine';

// Changes of the same kind by the same person in a row: the first line, with a
// button that opens the rest under it.

export default function ActivityRun({ run }: { run: FeedItem[] }) {
  const t = useTranslations('issue');
  const [open, setOpen] = useState(false);
  const [first, ...rest] = run;
  if (rest.length === 0) return <ActivityLine item={first} />;

  return (
    <>
      <ActivityLine
        item={first}
        trailing={
          <button
            type="button"
            aria-expanded={open}
            aria-label={t('feedRunToggle')}
            onClick={() => setOpen((prev) => !prev)}
            className="ms-1.5 inline-flex items-center gap-0.5 rounded px-1 text-xs text-muted-foreground tabular-nums hover:bg-accent hover:text-foreground"
          >
            +{rest.length}
            <ChevronDown className={cn('size-3 transition-transform', open && 'rotate-180')} />
          </button>
        }
      />
      {open && rest.map((item) => <ActivityLine key={item.id} item={item} nested />)}
    </>
  );
}
