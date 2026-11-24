import { useState } from 'react';
import { useTranslations } from 'next-intl';
import Modal from '@/components/common/overlay/Modal';
import { Button } from '@/components/ui/button';
import type {
  NotificationPreferences,
  ProjectNotificationPreferences,
} from '@/lib/api/endpoints/notificationPreferences';
import type { PreferencesOf } from '../../hooks/useAccountNotificationUpdate';
import { withChannels, type NotificationChannel } from '../../utils/notificationEvents';
import AccountNotificationEvents from './AccountNotificationEvents';

// One set of events for several projects. It starts from the defaults and replaces what
// the projects had on these channels.
export default function AccountNotificationEditDialog({
  projects,
  defaults,
  channels,
  onSave,
  onClose,
}: {
  projects: ProjectNotificationPreferences[];
  defaults: NotificationPreferences;
  channels: NotificationChannel[];
  onSave: (preferencesOf: PreferencesOf) => Promise<void>;
  onClose: () => void;
}) {
  const t = useTranslations('account.notifications');
  const tCommon = useTranslations('common');
  const [draft, setDraft] = useState(defaults);
  const [busy, setBusy] = useState(false);
  const count = projects.length;
  const title = t('editTitle', { count });

  async function save() {
    setBusy(true);
    await onSave((project) => withChannels(project.preferences ?? defaults, channels, draft));
    setBusy(false);
  }

  return (
    <Modal title={title} description={t('editText', { count })} wide onClose={onClose}>
      <AccountNotificationEvents
        name={title}
        value={draft}
        channels={channels}
        onChange={setDraft}
      />
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          {tCommon('cancel')}
        </Button>
        <Button onClick={() => void save()} disabled={busy}>
          {tCommon('save')}
        </Button>
      </div>
    </Modal>
  );
}
