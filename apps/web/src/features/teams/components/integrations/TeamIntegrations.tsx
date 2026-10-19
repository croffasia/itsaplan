import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import type { ResourcePermissions } from '@/lib/api/endpoints/roles';
import {
  startMcpSignIn,
  type IntegrationCredential,
  type IntegrationMeta,
} from '@/lib/api/endpoints/integrations';
import { useCredentialsPageQuery, useDeleteCredential } from '@/services/integrations.service';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/common/page/EmptyState';
import { integrationLabel } from '@/utils/integrationLabels';
import ConfirmDialog from '@/components/common/overlay/ConfirmDialog';
import ListPager from '@/components/common/ListPager';
import { usePaging } from '@/hooks/usePaging';
import { CredentialDialog } from './CredentialDialog';
import { CredentialRow } from './CredentialRow';

// The team's stored credentials as a table. Editing happens in a dialog; deleting
// confirms first. Adding is done from the tab header.
export default function TeamIntegrations({
  teamId,
  catalog,
  permissions,
}: {
  teamId: number;
  catalog: IntegrationMeta[];
  permissions: ResourcePermissions;
}) {
  const t = useTranslations('teams.integrations');
  const tCommon = useTranslations('common');
  const [editing, setEditing] = useState<IntegrationCredential | null>(null);
  const [deleting, setDeleting] = useState<IntegrationCredential | null>(null);
  const paging = usePaging();

  const credentialsQuery = useCredentialsPageQuery(teamId, paging.params);
  const credentials = credentialsQuery.data?.items ?? [];
  const total = credentialsQuery.data?.total ?? 0;
  const deleteCredential = useDeleteCredential(teamId);

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const signInError = searchParams.get('mcp_error');
  useEffect(() => {
    if (!signInError) return;
    toast.error(t('signInFailed', { reason: signInError }));
    router.replace(pathname);
  }, [signInError, router, pathname, t]);

  async function connect(credential: IntegrationCredential) {
    try {
      const { url } = await startMcpSignIn(teamId, credential.id);
      window.location.assign(url);
    } catch (err) {
      toast.error(t('signInFailed', { reason: err instanceof Error ? err.message : '' }));
    }
  }

  return (
    <>
      {total === 0 ? (
        <EmptyState title={t('empty')} description={t('emptyHint')} />
      ) : (
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <Table className="min-w-[560px] table-fixed">
              <colgroup>
                <col className="w-[30%]" />
                <col className="w-[46%]" />
                <col className="w-[24%]" />
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
                    integrationLabel={integrationLabel(catalog, c.integrationKey)}
                    canEdit={permissions.edit}
                    canDelete={permissions.delete}
                    onEdit={() => setEditing(c)}
                    onDelete={() => setDeleting(c)}
                    onConnect={c.integrationKey === 'mcp' ? () => connect(c) : undefined}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
          <ListPager paging={paging} total={total} />
        </div>
      )}

      {editing && (
        <CredentialDialog
          teamId={teamId}
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
              integration: integrationLabel(catalog, deleting.integrationKey),
            })}
          </div>
        </ConfirmDialog>
      )}
    </>
  );
}
