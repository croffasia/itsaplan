import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { SubtaskStateFilter } from '../../hooks/useSubtaskStateFilter';

export default function IssueSubtasksFilterChip({ filter }: { filter: SubtaskStateFilter }) {
  const t = useTranslations('issue.subtasks');
  if (filter.hidden.length === 0) return null;
  return (
    <span className="flex min-w-0 items-center gap-0.5 rounded-full bg-primary/10 py-0.5 ps-2 pe-0.5 text-xs text-primary">
      <span className="truncate">
        {t('hiding', { states: filter.hidden.map((c) => c.name).join(', ') })}
      </span>
      <button
        type="button"
        className="flex size-4 shrink-0 items-center justify-center rounded-full hover:bg-primary/20"
        aria-label={t('clearFilter')}
        onClick={filter.showAll}
      >
        <X className="size-3" />
      </button>
    </span>
  );
}
