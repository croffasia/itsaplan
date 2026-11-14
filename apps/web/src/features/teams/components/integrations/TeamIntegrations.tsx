import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { ResourcePermissions } from '@/lib/api/endpoints/roles';
import type { IntegrationCredential, IntegrationMeta } from '@/lib/api/endpoints/integrations';
import { useDeleteCredential } from '@/services/integrations.service';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import { integrationOf } from '@/utils/integrationLabels';
import ConfirmDialog from '@/components/common/overlay/ConfirmDialog';
import { CredentialDialog } from './CredentialDialog';
import { CredentialRow } from './CredentialRow';
import TeamIntegrationsEmpty from './TeamIntegrationsEmpty';

// One page of the team's stored credentials as a table. Editing happens in a dialog;
// deleting confirms first. Adding is done from the tab header.
export default function TeamIntegrations({
  teamId,
  teamName,
  catalog,
  credentials,
  pending,
  permissions,
  searchTerm,
  filtered,
}: {
  teamId: number;
  teamName: string;
  catalog: IntegrationMeta[];
  credentials: IntegrationCredential[];
  pending: boolean;
  permissions: ResourcePermissions;
  searchTerm: string | undefined;
  filtered: boolean;
}) {
  const t = useTranslations('teams.integrations');
  const tCommon = useTranslations('common');
  const [editing, setEditing] = useState<IntegrationCredential | null>(null);
  const [deleting, setDeleting] = useState<IntegrationCredential | null>(null);
  const deleteCredential = useDeleteCredential(teamId);

  if (pending) return <ListSkeleton rows={3} rowClassName="h-12" />;

  return (
    <>
      {credentials.length === 0 ? (
        <TeamIntegrationsEmpty searchTerm={searchTerm} filtered={filtered} />
      ) : (
        <div className="overflow-x-auto">
          <Table className="min-w-[560px] table-fixed">
            <colgroup>
              <col className="w-[34%]" />
              <col className="w-[50%]" />
              <col className="w-[16%]" />
            </colgroup>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs font-medium text-muted-foreground">
                  {t('columns.integration')}
                </TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground">
                  {t('columns.credentials')}
                </TableHead>
                <TableHead className="text-end text-xs font-medium text-muted-foreground">
                  {tCommon('actions')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {credentials.map((c) => (
                <CredentialRow
                  key={c.id}
                  credential={c}
                  integration={integrationOf(catalog, c.integrationKey)}
                  canEdit={permissions.edit}
                  canDelete={permissions.delete}
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
          teamId={teamId}
          teamName={teamName}
          catalog={catalog}
          existing={editing}
          onClose={() => setEditing(null)}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title={t('delete')}
          confirmLabel={t('delete')}
          onConfirm={async () => {
            await deleteCredential.mutateAsync(deleting.id);
            setDeleting(null);
          }}
          onClose={() => setDeleting(null)}
        >
          <div className="text-sm text-muted-foreground">
            {t('deleteMessage', {
              integration: integrationOf(catalog, deleting.integrationKey).label,
            })}
          </div>
        </ConfirmDialog>
      )}
    </>
  );
}
