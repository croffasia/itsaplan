import { useTranslations } from 'next-intl';
import { useIconHover } from '@animateicons/react';
import { CircleQuestionMarkIcon } from '@animateicons/react/lucide/circle-question-mark-icon';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { renderMarkdown } from '@/lib/markdown';

// An integration's markdown note on a credential field, behind a "?" by its label. A
// popover rather than a tooltip, so the links in the note can be clicked.
export function CredentialFieldHelp({ field, help }: { field: string; help: string }) {
  const t = useTranslations('teams.integrations');
  const { ref, triggerProps } = useIconHover();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t('fieldHelp', { field })}
          {...triggerProps}
          className="inline-flex rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <CircleQuestionMarkIcon ref={ref} size={14} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <div
          className="space-y-2 text-xs leading-relaxed text-muted-foreground [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-2 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:font-mono [&_code]:text-foreground [&_li+li]:mt-0.5 [&_ol]:list-decimal [&_ol]:ps-4 [&_ul]:list-disc [&_ul]:ps-4"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(help, { newTabLinks: true }) }}
        />
      </PopoverContent>
    </Popover>
  );
}
