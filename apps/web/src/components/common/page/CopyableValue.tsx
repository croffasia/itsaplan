'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';

// A value the reader copies out rather than fills in: a redirect URI to register
// with an identity provider, an endpoint to paste into one. Read-only on purpose, so
// it does not read as a form field.
export default function CopyableValue({
  title,
  value,
  hint,
  copyLabel,
}: {
  title: string;
  value: string;
  hint?: string;
  copyLabel: string;
}) {
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

  return (
    <div className="flex items-start justify-between gap-4 border-t border-border/60 pt-4">
      <div className="min-w-0 space-y-1">
        <div className="text-sm font-medium">{title}</div>
        <p className="truncate font-mono text-xs">{value}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="shrink-0"
        title={copyLabel}
        onClick={() => void copy()}
      >
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      </Button>
    </div>
  );
}
