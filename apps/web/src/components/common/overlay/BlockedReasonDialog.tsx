import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import Modal from './Modal';

// Asks why an issue is blocked before it moves into the blocked column.
export default function BlockedReasonDialog({
  onSubmit,
  onClose,
}: {
  onSubmit: (reason: string) => void;
  onClose: () => void;
}) {
  const t = useTranslations('issue.blockedReason');
  const tCommon = useTranslations('common');
  const [reason, setReason] = useState('');
  const trimmed = reason.trim();

  return (
    <Modal title={t('title')} description={t('description')} onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (trimmed) onSubmit(trimmed);
        }}
      >
        <Textarea
          autoFocus
          dir="auto"
          maxLength={1000}
          value={reason}
          placeholder={t('placeholder')}
          onChange={(e) => setReason(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey))
              e.currentTarget.form?.requestSubmit();
          }}
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {tCommon('cancel')}
          </Button>
          <Button type="submit" disabled={!trimmed}>
            {t('submit')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
