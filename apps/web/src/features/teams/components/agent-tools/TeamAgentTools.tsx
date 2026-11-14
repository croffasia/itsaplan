import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { ConfiguredTool } from '@/lib/api/endpoints/agentTools';
import type { IntegrationMeta } from '@/lib/api/endpoints/integrations';
import { useDeleteConfiguredTool } from '@/services/customTools.service';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/common/page/EmptyState';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import ConfirmDialog from '@/components/common/overlay/ConfirmDialog';
import { integrationOf } from '@/utils/integrationLabels';
import { ToolConfigRow } from './ToolConfigRow';

// The team's configured tools as a table: a catalog tool bound to an integration
// credential, callable by the internal agents of every project the team owns. Adding
// happens in a dialog opened from the section header; deleting confirms first.
// Enabling a configured tool on an agent is done in the agent editor.
export default function TeamAgentTools({
  teamId,
  catalog,
  tools,
  pending,
  canDelete,
  searchTerm,
}: {
  teamId: number;
  catalog: IntegrationMeta[];
  tools: ConfiguredTool[];
  pending: boolean;
  canDelete: boolean;
  searchTerm: string | undefined;
}) {
  const t = useTranslations('teams.tools');
  const tCommon = useTranslations('common');
  const [deleting, setDeleting] = useState<ConfiguredTool | null>(null);
  const deleteTool = useDeleteConfiguredTool(teamId);

  const catalogTools = useMemo(() => catalog.flatMap((i) => i.tools), [catalog]);
  const catalogTool = (toolKey: string) => catalogTools.find((tool) => tool.key === toolKey);

  if (pending) return <ListSkeleton rows={3} rowClassName="h-12" />;
  if (tools.length === 0)
    return searchTerm === undefined ? (
      <EmptyState title={t('empty')} description={t('emptyHint')} />
    ) : (
      <p className="text-sm text-muted-foreground">{t('noMatches', { query: searchTerm })}</p>
    );

  return (
    <div className="overflow-x-auto">
      <Table className="min-w-[760px] table-fixed">
        <colgroup>
          <col className="w-[50%]" />
          <col className="w-[28%]" />
          <col className="w-[13%]" />
          <col className="w-[9%]" />
        </colgroup>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="text-xs font-medium text-muted-foreground">{t('tool')}</TableHead>
            <TableHead className="text-xs font-medium text-muted-foreground">
              {t('scopes')}
            </TableHead>
            <TableHead className="text-xs font-medium text-muted-foreground">
              {t('dateAdded')}
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
              meta={catalogTool(tool.toolKey)}
              integration={integrationOf(catalog, tool.integrationKey)}
              canDelete={canDelete}
              onDelete={() => setDeleting(tool)}
            />
          ))}
        </TableBody>
      </Table>

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
            {t('deleteMessage', { tool: catalogTool(deleting.toolKey)?.label ?? deleting.toolKey })}
          </div>
        </ConfirmDialog>
      )}
    </div>
  );
}
