import type { IntegrationCredential, IntegrationMeta } from '@/lib/api/endpoints/integrations';
import { CredentialCatalogDialog } from './CredentialCatalogDialog';
import { CredentialFormDialog } from './CredentialFormDialog';

// Add or edit an integration credential. Adding with no integration given picks it from
// the catalog in the same dialog. Editing, or adding for a given integration, opens its
// form alone.
export function CredentialDialog({
  teamId,
  teamName,
  catalog,
  existing,
  integration,
  onClose,
}: {
  teamId: number;
  teamName: string;
  catalog: IntegrationMeta[];
  existing: IntegrationCredential | null;
  // The key of the integration a new credential is for.
  integration?: string;
  // Gets the new credential when the dialog closes on a create.
  onClose: (created?: IntegrationCredential) => void;
}) {
  const key = existing?.integrationKey ?? integration;
  if (key == null) {
    return (
      <CredentialCatalogDialog
        teamId={teamId}
        teamName={teamName}
        catalog={catalog}
        onClose={onClose}
      />
    );
  }

  const meta = catalog.find((c) => c.key === key);
  // A credential of an integration the catalog no longer carries has no form.
  if (!meta) return null;

  return (
    <CredentialFormDialog
      teamId={teamId}
      teamName={teamName}
      meta={meta}
      existing={existing}
      onClose={onClose}
    />
  );
}
