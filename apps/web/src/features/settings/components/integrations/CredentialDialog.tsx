import { useState } from 'react';
import type { IntegrationCredential, IntegrationMeta } from '@/lib/api';
import Modal from '@/components/common/overlay/Modal';
import { IntegrationPicker } from './IntegrationPicker';
import { CredentialForm } from './CredentialForm';

// Add or edit an integration credential. Adding is two steps: pick the integration from
// the searchable, grouped catalog (IntegrationPicker), then fill its credential form
// (CredentialForm). Editing skips the picker: the integration is fixed and the form
// opens directly.
export function CredentialDialog({
  projectKey,
  catalog,
  existing,
  onClose,
}: {
  projectKey: string;
  catalog: IntegrationMeta[];
  existing: IntegrationCredential | null;
  onClose: () => void;
}) {
  const isEdit = existing != null;
  const [integrationKey, setIntegrationKey] = useState<string | null>(
    existing?.integrationKey ?? null,
  );
  const meta = integrationKey ? catalog.find((c) => c.key === integrationKey) : undefined;

  if (!isEdit && !meta) {
    return (
      <Modal title="Add credential" projectKey={projectKey} onClose={onClose} wide>
        <IntegrationPicker catalog={catalog} onSelect={setIntegrationKey} />
      </Modal>
    );
  }

  // The integration key came from the picker or an existing credential, so meta is set.
  if (!meta) return null;

  return (
    <Modal
      title={isEdit ? 'Edit credential' : 'Add credential'}
      projectKey={projectKey}
      onClose={onClose}
    >
      <CredentialForm
        projectKey={projectKey}
        meta={meta}
        existing={existing}
        onBack={isEdit ? undefined : () => setIntegrationKey(null)}
        onDone={onClose}
      />
    </Modal>
  );
}
