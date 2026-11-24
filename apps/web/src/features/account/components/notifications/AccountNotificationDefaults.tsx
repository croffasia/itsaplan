import { useState } from 'react';
import { useTranslations } from 'next-intl';
import ConfirmDialog from '@/components/common/overlay/ConfirmDialog';
import { Button } from '@/components/ui/button';
import type { NotificationPreferences } from '@/lib/api/endpoints/notificationPreferences';
import type { NotificationChannel } from '../../utils/notificationEvents';
import AccountNotificationEvents from './AccountNotificationEvents';
import AccountNotificationFold from './AccountNotificationFold';

export default function AccountNotificationDefaults({
  defaults,
  channels,
  ownCount,
  onChange,
  onApplyToAll,
}: {
  defaults: NotificationPreferences;
  channels: NotificationChannel[];
  // How many projects have settings of their own.
  ownCount: number;
  onChange: (defaults: NotificationPreferences) => void;
  onApplyToAll: () => Promise<void>;
}) {
  const t = useTranslations('account.notifications');
  // The count the dialog opened with: the change shows before it is saved.
  const [confirming, setConfirming] = useState<number | null>(null);
  return (
    <section className="-mt-2 pb-5">
      <AccountNotificationFold
        heading="h2"
        title={t('defaults')}
        description={t('defaultsDescription')}
      >
        <AccountNotificationEvents
          name={t('defaults')}
          value={defaults}
          channels={channels}
          onChange={onChange}
        />
        {ownCount > 0 && (
          <div className="-me-3 mt-2 flex justify-end">
            <Button variant="ghost" size="sm" onClick={() => setConfirming(ownCount)}>
              {t('applyToAll')}
            </Button>
          </div>
        )}
      </AccountNotificationFold>
      {confirming !== null && (
        <ConfirmDialog
          title={t('applyToAllTitle')}
          confirmLabel={t('applyToAllConfirm')}
          destructive={false}
          onConfirm={async () => {
            await onApplyToAll();
            setConfirming(null);
          }}
          onClose={() => setConfirming(null)}
        >
          <p className="text-sm text-muted-foreground">
            {t('applyToAllText', { count: confirming })}
          </p>
        </ConfirmDialog>
      )}
    </section>
  );
}
