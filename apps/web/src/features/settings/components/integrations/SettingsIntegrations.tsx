import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import type { IntegrationCredential, ProjectDetail } from '@/lib/api';
import {
  useCredentialsQuery,
  useIntegrationCatalogQuery,
  useDeleteCredential,
} from '@/services/integrations.service';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import SettingsConfirmDeleteDialog from '../crud/SettingsConfirmDeleteDialog';
import { SettingsListEmpty } from '../crud/SettingsListEmpty';
import { useSettingsCan } from '../../context/settingsPermission';
import { CredentialDialog } from './CredentialDialog';
import { CredentialRow } from './CredentialRow';

// Project settings for integration credentials: the API keys of AI providers and the
// credentials of tool integrations. Secrets are write-only, so the list shows only a
// masked view. Adding and editing happen in a dialog; deleting confirms first.
export default function SettingsIntegrations({ project }: { project: ProjectDetail }) {
  const projectKey = project.project.key;
  const credentialsQuery = useCredentialsQuery(projectKey);
  const credentials = credentialsQuery.data ?? [];
  const catalogQuery = useIntegrationCatalogQuery(projectKey);
  const catalog = catalogQuery.data ?? [];
  const deleteCredential = useDeleteCredential(projectKey);
  const can = useSettingsCan();

  // Editing an existing credential; creating is done from the page header.
  const [editing, setEditing] = useState<IntegrationCredential | null>(null);
  const [deleting, setDeleting] = useState<IntegrationCredential | null>(null);

  const integrationLabel = (key: string) => catalog.find((c) => c.key === key)?.label ?? key;

  return (
    <>
      {credentials.length === 0 ? (
        <SettingsListEmpty
          icon={KeyRound}
          title="No credentials yet"
          description="Add a credential for an AI provider or a tool integration so agents can use it."
        />
      ) : (
        <div className="space-y-4">
          <Table className="min-w-[720px] table-fixed">
            <colgroup>
              <col className="w-[32%]" />
              <col className="w-[54%]" />
              <col className="w-[14%]" />
            </colgroup>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs font-medium text-muted-foreground">
                  Integration
                </TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground">
                  Credentials
                </TableHead>
                <TableHead className="text-right text-xs font-medium text-muted-foreground">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {credentials.map((c) => (
                <CredentialRow
                  key={c.id}
                  credential={c}
                  integrationLabel={integrationLabel(c.integrationKey)}
                  canEdit={can('edit')}
                  canDelete={can('delete')}
                  onEdit={() => setEditing(c)}
                  onDelete={() => setDeleting(c)}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {editing && (
        <CredentialDialog
          projectKey={projectKey}
          catalog={catalog}
          existing={editing}
          onClose={() => setEditing(null)}
        />
      )}

      {deleting && (
        <SettingsConfirmDeleteDialog
          title="Delete credential"
          confirmLabel="Delete credential"
          message={
            <>
              Delete the {integrationLabel(deleting.integrationKey)} credential? Agents and tools
              using it will stop working until you add a new one.
            </>
          }
          onConfirm={async () => {
            await deleteCredential.mutateAsync(deleting.id);
            setDeleting(null);
          }}
          onClose={() => setDeleting(null)}
        />
      )}
    </>
  );
}
