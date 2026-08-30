'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Modal from '@/components/common/overlay/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCreateInstanceScimToken } from '../../services/god.service';

// The generated token is kept in this dialog only, never lifted into page state: it
// is shown once, right after it is generated, and cannot be retrieved later.
// Generating one replaces the previous token, which stops working immediately.
export default function GodScimTokenDialog({ onClose }: { onClose: () => void }) {
  const t = useTranslations('god.scim.tokenDialog');
  const tCommon = useTranslations('common');
  const create = useCreateInstanceScimToken();
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked (no permission / insecure origin); ignore.
    }
  }

  if (token !== null) {
    return (
      <Modal title={t('createdTitle')} onClose={onClose}>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{t('createdDescription')}</p>
          <div className="flex items-center gap-2">
            <Input
              readOnly
              value={token}
              className="font-mono text-xs"
              onFocus={(e) => e.currentTarget.select()}
            />
            <Button
              variant="outline"
              size="icon"
              className="shrink-0"
              title={t('copy')}
              onClick={() => void copy()}
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

  return (
    <Modal title={t('title')} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{t('description')}</p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={create.isPending}>
            {tCommon('cancel')}
          </Button>
          <Button
            type="button"
            disabled={create.isPending}
            onClick={() => create.mutate(undefined, { onSuccess: (data) => setToken(data.token) })}
          >
            {create.isPending ? t('submitPending') : t('submit')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
