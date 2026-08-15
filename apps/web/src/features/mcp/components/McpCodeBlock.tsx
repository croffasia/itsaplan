'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

export default function McpCodeBlock({ code }: { code: string }) {
  const t = useTranslations('mcp');
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success(t('copied'));
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="group relative">
      {/* The snippet stays left to right in a mirrored page; the copy button follows
          the interface and moves to the other corner, so the room kept clear for it
          is on the end side too. */}
      <pre className="overflow-x-auto rounded-md bg-muted/60 p-3 pe-11 font-mono text-xs leading-relaxed">
        <code dir="ltr" className="block text-start">
          {code}
        </code>
      </pre>
      <button
        type="button"
        aria-label={t('copyAria')}
        onClick={copy}
        className="absolute end-2 top-2 grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      </button>
    </div>
  );
}
