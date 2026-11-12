import type { SubtaskMode } from '@/lib/api/endpoints/issues';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';

export interface SubtaskDisposalOption {
  mode: SubtaskMode;
  label: string;
  hint: string;
}

// The subtask choice as radio options. The picked new parent is shown inside the
// reassign option, with a way to pick another.
export default function IssueSubtaskDisposalOptions({
  name,
  legend,
  options,
  mode,
  newParent,
  onSelect,
}: {
  name: string;
  legend: string;
  options: SubtaskDisposalOption[];
  mode: SubtaskMode | null;
  newParent: { identifier: string; title: string } | null;
  // 'reassign' is selected again to change the new parent.
  onSelect: (mode: SubtaskMode) => void;
}) {
  const t = useTranslations('issue.subtaskDisposal');
  return (
    <fieldset className="min-w-0 space-y-1">
      <legend className="mb-2 text-sm font-medium">{legend}</legend>
      {options.map((option) => (
        <div
          key={option.mode}
          className={cn(
            'rounded-lg px-3 py-2.5 transition-colors',
            mode === option.mode ? 'bg-secondary' : 'hover:bg-accent',
          )}
        >
          <label className="flex cursor-pointer gap-3">
            <input
              type="radio"
              name={name}
              checked={mode === option.mode}
              onChange={() => onSelect(option.mode)}
              className="mt-1 size-4 shrink-0 cursor-pointer accent-foreground"
            />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-sm font-medium">{option.label}</span>
              <span className="text-sm text-muted-foreground">{option.hint}</span>
            </span>
          </label>
          {option.mode === 'reassign' && mode === 'reassign' && newParent && (
            <div className="mt-2 flex min-w-0 items-center gap-2 ps-7 text-sm">
              <span className="shrink-0 whitespace-nowrap text-muted-foreground">
                {t('newParent')}
              </span>
              <span className="flex min-w-0 items-center gap-1.5 rounded-md bg-background px-2 py-0.5">
                <span dir="ltr" className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {newParent.identifier}
                </span>
                <span dir="auto" className="truncate">
                  {newParent.title}
                </span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 shrink-0 px-2"
                onClick={() => onSelect('reassign')}
              >
                {t('change')}
              </Button>
            </div>
          )}
        </div>
      ))}
    </fieldset>
  );
}
