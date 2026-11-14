import { useTranslations } from 'next-intl';
import type { IntegrationCredential, IntegrationMeta } from '@/lib/api/endpoints/integrations';
import { useIntegrationOptionsQuery } from '@/services/integrations.service';
import Modal from '@/components/common/overlay/Modal';
import { useCredentialForm } from '../../hooks/useCredentialForm';
import { CredentialFields } from './CredentialFields';
import { CredentialFormFooter } from './CredentialFormFooter';

// Edit a credential, or add one for an integration chosen elsewhere: its form alone.
export function CredentialFormDialog({
  teamId,
  teamName,
  meta,
  existing,
  onClose,
}: {
  teamId: number;
  teamName: string;
  meta: IntegrationMeta;
  existing: IntegrationCredential | null;
  onClose: (created?: IntegrationCredential) => void;
}) {
  const t = useTranslations('teams.integrations');
  const form = useCredentialForm(teamId, meta, existing, onClose);
  // Only a new credential can be a second one for the integration.
  const options = useIntegrationOptionsQuery(existing ? null : teamId).data;
  const connected = options?.some((o) => o.integrationKey === meta.key) ?? false;

  return (
    <Modal title={existing ? t('edit') : t('add')} scope={teamName} onClose={() => onClose()} wide>
      <div className="space-y-6">
        <CredentialFields meta={meta} existing={existing} form={form} connected={connected} />
        <CredentialFormFooter form={form} onCancel={() => onClose()} />
      </div>
    </Modal>
  );
}
