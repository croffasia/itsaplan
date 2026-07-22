'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { toast } from 'sonner';

export default function McpCodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="group relative">
      <pre className="overflow-x-auto rounded-md bg-muted/60 p-3 pr-11 font-mono text-xs leading-relaxed">
        <code>{code}</code>
      </pre>
      <button
        type="button"
        aria-label="Copy"
        onClick={copy}
        className="absolute top-2 right-2 grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      </button>
    </div>
  );
}
