import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

// A snippet the reader is meant to run or save, with a copy button.
export function AgentRunnerCodeBlock({ code }: { code: string }) {
  const t = useTranslations('settings.agents');
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked (no permission / insecure origin); ignore.
    }
  }

  return (
    <div className="flex items-start gap-2">
      {/* A shell command reads left to right whatever the interface language is. */}
      <pre
        dir="ltr"
        className="min-w-0 flex-1 overflow-x-auto rounded-md border bg-muted/40 px-2.5 py-2 text-start font-mono text-xs"
      >
        {code}
      </pre>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="shrink-0"
        title={t('runnerCopyCommand')}
        onClick={copy}
      >
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      </Button>
    </div>
  );
}
