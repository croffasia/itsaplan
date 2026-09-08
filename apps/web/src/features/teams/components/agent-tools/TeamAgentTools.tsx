import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { ResourcePermissions } from '@/lib/api/endpoints/roles';
import type { ConfiguredTool } from '@/lib/api/endpoints/agentTools';
import type { IntegrationMeta } from '@/lib/api/endpoints/integrations';
import {
  useConfiguredToolsPageQuery,
  useDeleteConfiguredTool,
} from '@/services/customTools.service';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/common/page/EmptyState';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import ConfirmDialog from '@/components/common/overlay/ConfirmDialog';
import ListPager from '@/components/common/ListPager';
import { usePaging } from '@/hooks/usePaging';
import { integrationLabel } from '@/utils/integrationLabels';
import { ToolConfigRow } from './ToolConfigRow';

// The team's configured tools as a table: a catalog tool bound to an integration
// credential, callable by the internal agents of every project the team owns. Adding
// happens in a dialog opened from the section header; deleting confirms first.
// Enabling a configured tool on an agent is done in the agent editor.
export default function TeamAgentTools({
  teamId,
  catalog,
  permissions,
}: {
  teamId: number;
  catalog: IntegrationMeta[];
  permissions: ResourcePermissions;
}) {
  const t = useTranslations('teams.tools');
  const tCommon = useTranslations('common');
  const [deleting, setDeleting] = useState<ConfiguredTool | null>(null);
  const paging = usePaging();

  const toolsQuery = useConfiguredToolsPageQuery(teamId, paging.params);
  const tools = toolsQuery.data?.items ?? [];
  const total = toolsQuery.data?.total ?? 0;
  const deleteTool = useDeleteConfiguredTool(teamId);

  const catalogTools = useMemo(() => catalog.flatMap((i) => i.tools), [catalog]);
  const catalogTool = (toolKey: string) => catalogTools.find((tool) => tool.key === toolKey);
  const toolLabel = (toolKey: string) => catalogTool(toolKey)?.label ?? toolKey;
  const toolScopes = (toolKey: string) => catalogTool(toolKey)?.scopes ?? [];

  return (
    <>
      {toolsQuery.isPending ? (
        <ListSkeleton rows={3} rowClassName="h-12" />
      ) : total === 0 ? (
        <EmptyState title={t('empty')} description={t('emptyHint')} />
      ) : (
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <Table className="min-w-[760px] table-fixed">
              <colgroup>
                <col className="w-[34%]" />
                <col className="w-[52%]" />
                <col className="w-[14%]" />
              </colgroup>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs font-medium text-muted-foreground">
                    {t('tool')}
                  </TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground">
                    {t('scopes')}
                  </TableHead>
                  <TableHead className="text-end text-xs font-medium text-muted-foreground">
                    {tCommon('actions')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tools.map((tool) => (
                  <ToolConfigRow
                    key={tool.id}
                    tool={tool}
                    toolLabel={toolLabel(tool.toolKey)}
                    integrationLabel={integrationLabel(catalog, tool.integrationKey)}
                    scopes={toolScopes(tool.toolKey)}
                    canDelete={permissions.delete}
                    onDelete={() => setDeleting(tool)}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
          <ListPager paging={paging} total={total} />
        </div>
      )}

      {deleting && (
        <ConfirmDialog
          title={t('delete')}
          confirmLabel={t('delete')}
          onConfirm={async () => {
            await deleteTool.mutateAsync(deleting.id);
            setDeleting(null);
          }}
          onClose={() => setDeleting(null)}
        >
          <div className="text-sm text-muted-foreground">
            {t('deleteMessage', { tool: toolLabel(deleting.toolKey) })}
          </div>
        </ConfirmDialog>
      )}
    </>
  );
}
