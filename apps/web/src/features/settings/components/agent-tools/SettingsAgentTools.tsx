import { useMemo, useState } from 'react';
import type { ConfiguredTool, ProjectDetail } from '@/lib/api';
import { useConfiguredToolsQuery, useDeleteConfiguredTool } from '@/services/customTools.service';
import { useIntegrationCatalogQuery } from '@/services/integrations.service';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/common/page/EmptyState';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import SettingsConfirmDeleteDialog from '../crud/SettingsConfirmDeleteDialog';
import { useSettingsCan } from '../../context/settingsPermission';
import { ToolConfigRow } from './ToolConfigRow';
import { integrationLabel } from '../../utils/integrationLabels';
import { useTranslations } from 'next-intl';

// Project settings for configured tools: a catalog tool bound to an integration
// credential. Adding picks one or more tools of one integration and a credential of
// that integration; deleting confirms first. Enabling a configured tool on an agent is
// done on the agent editor.
export default function SettingsAgentTools({ project }: { project: ProjectDetail }) {
  const t = useTranslations('settings.tools');
  const tCommon = useTranslations('common');
  const projectKey = project.project.key;
  const toolsQuery = useConfiguredToolsQuery(projectKey);
  const tools = toolsQuery.data ?? [];
  const catalogQuery = useIntegrationCatalogQuery(projectKey);
  const catalog = useMemo(() => catalogQuery.data ?? [], [catalogQuery.data]);
  const deleteTool = useDeleteConfiguredTool(projectKey);
  const can = useSettingsCan();

  const [deleting, setDeleting] = useState<ConfiguredTool | null>(null);

  const catalogTools = useMemo(() => catalog.flatMap((i) => i.tools), [catalog]);
  const catalogTool = (toolKey: string) => catalogTools.find((t) => t.key === toolKey);
  const toolLabel = (toolKey: string) => catalogTool(toolKey)?.label ?? toolKey;
  const toolScopes = (toolKey: string) => catalogTool(toolKey)?.scopes ?? [];

  return (
    <>
      {toolsQuery.isPending ? (
        <ListSkeleton rows={3} rowClassName="h-12" />
      ) : tools.length === 0 ? (
        <EmptyState title={t('empty')} description={t('emptyHint')} />
      ) : (
        <div className="space-y-4">
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
                  canDelete={can('delete')}
                  onDelete={() => setDeleting(tool)}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {deleting && (
        <SettingsConfirmDeleteDialog
          title={t('delete')}
          confirmLabel={t('delete')}
          message={<>{t('deleteMessage', { tool: toolLabel(deleting.toolKey) })}</>}
          onConfirm={async () => {
            await deleteTool.mutateAsync(deleting.id);
            setDeleting(null);
          }}
          onClose={() => setDeleting(null)}
        />
      )}
    </>
  );
}
