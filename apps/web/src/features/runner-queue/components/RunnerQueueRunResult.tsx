import { useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import Markdown from '@/components/common/Markdown';
import RunnerQueueRunSection from './RunnerQueueRunSection';

export default function RunnerQueueRunResult({ output }: { output: string }) {
  const t = useTranslations('issue.agentRuns');
  const tCommon = useTranslations('common');
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const body = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = body.current;
    if (el) setOverflows(el.scrollHeight > el.clientHeight);
  }, [output]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked (no permission / insecure origin); ignore.
    }
  }

  const folded = !expanded && overflows;
  return (
    <RunnerQueueRunSection
      title={t('result')}
      actions={
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={copied ? tCommon('copied') : tCommon('copy')}
          onClick={() => void copy()}
        >
          {copied ? <Check /> : <Copy />}
        </Button>
      }
    >
      {output.startsWith('…') && <p className="text-xs text-muted-foreground">{t('outputTail')}</p>}
      <div
        ref={body}
        className={cn(
          'relative text-[15px] leading-relaxed',
          !expanded && 'max-h-72 overflow-hidden',
        )}
      >
        <Markdown>{output}</Markdown>
        {folded && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-linear-to-t from-background" />
        )}
      </div>
      {folded && (
        <Button variant="ghost" size="sm" className="-ms-3" onClick={() => setExpanded(true)}>
          {tCommon('showMore')}
        </Button>
      )}
    </RunnerQueueRunSection>
  );
}
