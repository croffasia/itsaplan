import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import Modal from '@/components/common/overlay/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslations } from 'next-intl';

// One-time reveal of an agent's plaintext API key, shown right after create or
// regenerate. The secret is passed in and never stored in list state — it is only
// available here, and cannot be retrieved again.
export default function AgentKeyRevealModal({
  title,
  apiKey,
  onClose,
}: {
  title: string;
  apiKey: string;
  onClose: () => void;
}) {
  const t = useTranslations('settings.agents');
  const tCommon = useTranslations('common');
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
    <Modal title={title} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{t('keyWarning')}</p>
        <div className="flex items-center gap-2">
          <Input
            readOnly
            value={apiKey}
            className="font-mono text-xs"
            onFocus={(e) => e.currentTarget.select()}
          />
          <Button
            variant="outline"
            size="icon"
            className="shrink-0"
            title={t('copyKey')}
            onClick={copy}
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          </Button>
        </div>
        <div className="flex justify-end">
          <Button onClick={onClose}>{tCommon('done')}</Button>
        </div>
      </div>
    </Modal>
  );
}
