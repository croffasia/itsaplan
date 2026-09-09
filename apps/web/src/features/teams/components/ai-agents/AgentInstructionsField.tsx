import { useState } from 'react';
import { Check, Code, Copy, Maximize2, Type } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useTranslations } from 'next-intl';
import AgentInstructionsEditor from './AgentInstructionsEditor';

// The agent's system-prompt field, written as markdown. An inline editor plus a
// maximize control next to the label that opens the same value in a large dialog
// for comfortable editing. Used in both the compact side panel and the full-width
// layout. The source toggle swaps the editor for the raw markdown, which is what the
// agent runtime receives.
export function AgentInstructionsField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const t = useTranslations('teams.agents');
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked (no permission / insecure origin); ignore.
    }
  }

  const controls = (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => void copy()}
        className="-my-1 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
        aria-label={t('copyInstructions')}
        title={t('copyInstructions')}
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      </button>
      <button
        type="button"
        onClick={() => setSource((v) => !v)}
        className="-my-1 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
        aria-label={source ? t('showEditor') : t('showSource')}
        title={source ? t('showEditor') : t('showSource')}
      >
        {source ? <Type className="size-3.5" /> : <Code className="size-3.5" />}
      </button>
    </div>
  );

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{t('instructionsLabel')}</span>
        <div className="flex items-center gap-1">
          {!open && controls}
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
      </div>
      {/* Only one editor exists at a time: the editor reads its content on mount, so
          it has to remount to pick up the dialog's or the source view's edits. */}
      {!open &&
        (source ? (
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={t('instructionsPlaceholder')}
            aria-label={t('instructionsLabel')}
            className="max-h-43 min-h-24 overflow-y-auto font-mono text-xs md:text-xs"
          />
        ) : (
          <AgentInstructionsEditor
            defaultValue={value}
            onChange={onChange}
            placeholder={t('instructionsPlaceholder')}
            ariaLabel={t('instructionsLabel')}
            slashContainer='[data-slot="sheet-content"]'
            className="flex max-h-43 min-h-24 w-full flex-col overflow-y-auto rounded-md border border-input px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50"
          />
        ))}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          className="flex h-[calc(100vh-2rem)] w-[calc(100vw-2rem)] max-w-none flex-col gap-4 sm:max-w-none"
        >
          <DialogHeader className="flex-row items-center justify-between space-y-0">
            <DialogTitle>{t('instructions')}</DialogTitle>
            <div className="flex items-center gap-3">
              {open && controls}
              <DialogClose asChild>
                <Button type="button" size="sm">
                  {t('done')}
                </Button>
              </DialogClose>
            </div>
          </DialogHeader>
          {source ? (
            <Textarea
              autoFocus
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={t('instructionsPlaceholder')}
              aria-label={t('instructionsLabel')}
              className="min-h-0 flex-1 resize-none overflow-y-auto font-mono text-sm"
            />
          ) : (
            <AgentInstructionsEditor
              autoFocus
              defaultValue={value}
              onChange={onChange}
              placeholder={t('instructionsPlaceholder')}
              ariaLabel={t('instructionsLabel')}
              slashContainer='[data-slot="dialog-content"]'
              className="flex min-h-0 flex-1 flex-col overflow-y-auto text-base leading-relaxed"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
