import { useTranslations } from 'next-intl';
import { useIconHover } from '@animateicons/react';
import { CircleQuestionMarkIcon } from '@animateicons/react/lucide/circle-question-mark-icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { JobField } from '../../utils/jobFields';

export default function GodJobsField({
  field,
  value,
  invalid,
  note,
  onChange,
}: {
  field: JobField;
  value: string;
  invalid: boolean;
  note?: string;
  onChange: (value: string) => void;
}) {
  const t = useTranslations('god.jobs');
  const { ref, triggerProps } = useIconHover();
  const id = `job-${field.path}`;
  const hint = t('withRange', { hint: t(`${field.path}Hint`), min: field.min, max: field.max });
  const problem = invalid ? t('range', { min: field.min, max: field.max }) : note;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Label htmlFor={id}>{t(field.path)}</Label>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={hint}
              {...triggerProps}
              className="inline-flex rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <CircleQuestionMarkIcon ref={ref} size={14} />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">{hint}</TooltipContent>
        </Tooltip>
      </div>
      <Input
        id={id}
        type="number"
        min={field.min}
        max={field.max}
        step={1}
        inputMode="numeric"
        aria-invalid={Boolean(problem)}
        aria-describedby={problem ? `${id}-hint ${id}-problem` : `${id}-hint`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <span id={`${id}-hint`} className="sr-only">
        {hint}
      </span>
      {problem && (
        <p id={`${id}-problem`} className="text-xs text-destructive">
          {problem}
        </p>
      )}
    </div>
  );
}
