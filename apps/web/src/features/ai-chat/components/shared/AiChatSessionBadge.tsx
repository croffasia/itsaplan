'use client';

import { Check, Copy, Terminal } from 'lucide-react';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

// The coding agent session the agent's runner keeps for this conversation on its own
// machine. It is what the operator resumes to read the full transcript — `claude
// --resume <id>` in the runner's working directory. `compact` drops the id from the
// trigger, for the floating window, where the header has no room for it.
export function AiChatSessionBadge({
  sessionId,
  compact = false,
}: {
  sessionId: string;
  compact?: boolean;
}) {
  const t = useTranslations('aiChat');
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(sessionId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size={compact ? 'icon' : 'sm'}
          title={t('sessionLabel')}
          className={
            compact
              ? 'size-7 shrink-0 text-muted-foreground hover:text-foreground'
              : 'h-7 min-w-0 gap-1.5 px-2 text-muted-foreground hover:text-foreground'
          }
        >
          <Terminal className="size-3.5 shrink-0" />
          {compact ? (
            <span className="sr-only">{t('sessionLabel')}</span>
          ) : (
            <span className="max-w-56 truncate font-mono text-xs" dir="ltr">
              {sessionId}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 space-y-2">
        <p className="text-sm font-medium">{t('sessionLabel')}</p>
        <p className="text-xs text-muted-foreground">{t('sessionHint')}</p>
        <div className="flex items-start gap-1">
          <span className="min-w-0 flex-1 font-mono text-xs break-all" dir="ltr">
            {sessionId}
          </span>
          <Button
            variant="ghost"
            size="icon"
            title={t('copySession')}
            onClick={() => void copy()}
            className="size-6 shrink-0 text-muted-foreground"
          >
            {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
            <span className="sr-only">{t('copySession')}</span>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
