import { useState } from 'react';
import { Check, Copy, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslations } from 'next-intl';

// Bullets stand in for the hidden part of the key: a fixed count, so the key's real
// length stays private.
const HIDDEN = '•'.repeat(24);

// A plaintext API key, hidden behind bullets until revealed and copyable either way.
// The first characters stay visible so the key can be told apart from another one
// without exposing the secret.
export default function AgentKeyValue({ apiKey }: { apiKey: string }) {
  const t = useTranslations('settings.agents');
  const [shown, setShown] = useState(false);
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
    <div className="flex items-center gap-2">
      <code
        dir="ltr"
        className="min-w-0 flex-1 truncate rounded-md bg-background/60 px-3 py-2 font-mono text-xs"
      >
        {shown ? apiKey : `${apiKey.slice(0, 6)}${HIDDEN}`}
      </code>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 shrink-0"
        aria-label={shown ? t('hideKey') : t('showKey')}
        title={shown ? t('hideKey') : t('showKey')}
        onClick={() => setShown((v) => !v)}
      >
        {shown ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="size-8 shrink-0"
        aria-label={t('copyKey')}
        title={t('copyKey')}
        onClick={copy}
      >
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      </Button>
    </div>
  );
}
