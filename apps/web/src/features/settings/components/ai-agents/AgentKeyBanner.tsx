import { useState } from 'react';
import { Check, Copy, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// Inline, one-time reveal of a new external agent's plaintext API key, shown at the
// top of the sheet form right after create. The secret is never stored in list
// state — it is only available here and cannot be retrieved again. Dismissable.
export default function AgentKeyBanner({
  apiKey,
  onDismiss,
}: {
  apiKey: string;
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked (no permission / insecure origin); ignore.
    }
  }

  return (
    <div className="space-y-2 rounded-md border border-primary/40 bg-primary/5 p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Copy this API key now. For security, it is shown only once and cannot be retrieved later.
        </p>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 text-muted-foreground hover:text-foreground"
          title="Dismiss"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="flex items-center gap-2">
        <Input
          readOnly
          value={apiKey}
          className="font-mono text-xs"
          onFocus={(e) => e.currentTarget.select()}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="shrink-0"
          title="Copy key"
          onClick={copy}
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        </Button>
      </div>
    </div>
  );
}
