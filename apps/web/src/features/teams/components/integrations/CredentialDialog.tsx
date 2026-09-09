import { useState } from 'react';
import type { IntegrationCredential, IntegrationMeta } from '@/lib/api/endpoints/integrations';
import Modal from '@/components/common/overlay/Modal';
import { IntegrationPicker } from './IntegrationPicker';
import { CredentialForm } from './CredentialForm';
import { useTranslations } from 'next-intl';

// Add or edit an integration credential. Adding is two steps: pick the integration from
// the searchable, grouped catalog (IntegrationPicker), then fill its credential form
// (CredentialForm). Editing skips the picker: the integration is fixed and the form
// opens directly.
export function CredentialDialog({
  teamId,
  catalog,
  existing,
  onClose,
}: {
  teamId: number;
  catalog: IntegrationMeta[];
  existing: IntegrationCredential | null;
  onClose: () => void;
}) {
  const t = useTranslations('teams.integrations');
  const isEdit = existing != null;
  const [integrationKey, setIntegrationKey] = useState<string | null>(
    existing?.integrationKey ?? null,
  );
  const meta = integrationKey ? catalog.find((c) => c.key === integrationKey) : undefined;

  if (!isEdit && !meta) {
    return (
      <Modal title={t('add')} onClose={onClose} wide>
        <IntegrationPicker catalog={catalog} onSelect={setIntegrationKey} />
      </Modal>
    );
  }

  // The integration key came from the picker or an existing credential, so meta is set.
  if (!meta) return null;

  return (
    <Modal title={isEdit ? t('edit') : t('add')} onClose={onClose}>
      <CredentialForm
        teamId={teamId}
        meta={meta}
        existing={existing}
        onBack={isEdit ? undefined : () => setIntegrationKey(null)}
        onDone={onClose}
      />
    </Modal>
  );
}
