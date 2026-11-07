import { useState } from 'react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import ConfirmDialog from '@/components/common/overlay/ConfirmDialog';
import { useRevokeAllShares } from '../services/shares.service';

// The Public page's header action: revokes every link the viewer may revoke, after a
// confirmation.
export default function PublicSharesRevokeAll({ projectKey }: { projectKey: string }) {
  const t = useTranslations('common.share');
  const [confirming, setConfirming] = useState(false);
  const revokeAll = useRevokeAllShares(projectKey);

  return (
    <>
      <Button variant="destructive" size="sm" onClick={() => setConfirming(true)}>
        {t('revokeAll')}
      </Button>
      {confirming && (
        <ConfirmDialog
          title={t('revokeAllTitle')}
          confirmLabel={t('revokeAll')}
          onConfirm={async () => {
            const { revoked } = await revokeAll.mutateAsync();
            toast.success(t('revokeAllDone', { count: revoked }));
            setConfirming(false);
          }}
          onClose={() => setConfirming(false)}
        >
          {t('revokeAllHint')}
        </ConfirmDialog>
      )}
    </>
  );
}
