import { useState } from 'react';
import { Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useTranslations } from 'next-intl';
import AgentInstructionsEditor from './AgentInstructionsEditor';

// The agent's system-prompt field, written as markdown. An inline editor plus a
// maximize control next to the label that opens the same value in a large dialog
// for comfortable editing. Used in both the compact side panel and the full-width
// layout.
export function AgentInstructionsField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const t = useTranslations('settings.agents');
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{t('instructionsLabel')}</span>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="-my-1 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
          aria-label={t('expandInstructions')}
          title={t('expandEditor')}
        >
          <Maximize2 className="size-3.5" />
        </button>
      </div>
      {/* Only one of the two editors exists at a time: the editor reads its content
          on mount, so the inline one has to remount to pick up the dialog's edits. */}
      {!open && (
        <AgentInstructionsEditor
          defaultValue={value}
          onChange={onChange}
          placeholder={t('instructionsPlaceholder')}
          ariaLabel={t('instructionsLabel')}
          slashContainer='[data-slot="sheet-content"]'
          className="flex min-h-24 w-full flex-col rounded-md border border-input px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50"
        />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          className="flex h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] max-w-none flex-col gap-4 sm:max-w-none"
        >
          <DialogHeader className="flex-row items-center justify-between space-y-0">
            <DialogTitle>{t('instructions')}</DialogTitle>
            <DialogClose asChild>
              <Button type="button" size="sm">
                {t('done')}
              </Button>
            </DialogClose>
          </DialogHeader>
          <AgentInstructionsEditor
            autoFocus
            defaultValue={value}
            onChange={onChange}
            placeholder={t('instructionsPlaceholder')}
            ariaLabel={t('instructionsLabel')}
            slashContainer='[data-slot="dialog-content"]'
            className="flex min-h-0 flex-1 flex-col overflow-y-auto text-base leading-relaxed"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
