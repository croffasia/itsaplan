import { useEffect, useState } from 'react';
import { useMutationState } from '@tanstack/react-query';
import type { IssuePatch } from '@/lib/api/endpoints/issues';
import { issueUpdateMutationKey } from '@/services/issues.service';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';

const SHOWN_MS = 2000;

// "Saved" for a moment after the server stored the issue's description, so the person
// who typed it knows it is kept. Shown beside the issue key in the side panel and in
// the header of the issue page.
export default function IssueSavedNote({
  issueId,
  className,
}: {
  issueId: number;
  className?: string;
}) {
  const t = useTranslations('issue');
  const last = useMutationState({
    filters: {
      mutationKey: issueUpdateMutationKey,
      status: 'success',
      predicate: (mutation) => {
        const vars = mutation.state.variables as { id: number; patch: IssuePatch } | undefined;
        return vars?.id === issueId && vars.patch.description !== undefined;
      },
    },
    select: (mutation) => mutation.state.submittedAt,
  }).at(-1);
  // The last save already shown, or made before the detail opened.
  const [seen, setSeen] = useState(last);
  const shown = last !== undefined && (seen === undefined || last > seen);

  useEffect(() => {
    const timer = setTimeout(() => setSeen(last), SHOWN_MS);
    return () => clearTimeout(timer);
  }, [last]);

  return (
    <span role="status" className={cn('text-xs text-muted-foreground/60', className)}>
      {shown && <span className="animate-in duration-300 fade-in">{t('saved')}</span>}
    </span>
  );
}
