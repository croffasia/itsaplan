import { useMemo, useState } from 'react';
import type { ConfiguredTool, ProjectDetail } from '@/lib/api';
import { AGENT_TOOLS_SECTION } from '@/utils/settingsSections';
import { useConfiguredToolsQuery, useDeleteConfiguredTool } from '@/services/customTools.service';
import { useIntegrationCatalogQuery } from '@/services/integrations.service';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import SettingsConfirmDeleteDialog from '../crud/SettingsConfirmDeleteDialog';
import { SettingsListEmpty } from '../crud/SettingsListEmpty';
import { useSettingsCan } from '../../context/settingsPermission';
import { ToolConfigRow } from './ToolConfigRow';
import { integrationLabel } from '../../utils/integrationLabels';

// Project settings for configured tools: a catalog tool bound to an integration
// credential. Adding picks a tool and a credential of its integration; deleting
// confirms first. Enabling a configured tool on an agent is done on the agent editor.
export default function SettingsAgentTools({ project }: { project: ProjectDetail }) {
  const projectKey = project.project.key;
  const toolsQuery = useConfiguredToolsQuery(projectKey);
  const tools = toolsQuery.data ?? [];
  const catalogQuery = useIntegrationCatalogQuery(projectKey);
  const catalog = catalogQuery.data ?? [];
  const deleteTool = useDeleteConfiguredTool(projectKey);
  const can = useSettingsCan();

  const [deleting, setDeleting] = useState<ConfiguredTool | null>(null);

  const catalogTools = useMemo(() => catalog.flatMap((i) => i.tools), [catalog]);
  const catalogTool = (toolKey: string) => catalogTools.find((t) => t.key === toolKey);
  const toolLabel = (toolKey: string) => catalogTool(toolKey)?.label ?? toolKey;
  const toolScopes = (toolKey: string) => catalogTool(toolKey)?.scopes ?? [];

  return (
    <>
      {tools.length === 0 ? (
        <SettingsListEmpty
          icon={AGENT_TOOLS_SECTION.icon}
          title="No tools configured yet"
          description="Connect a tool to an integration credential so agents can call it, then enable it on an agent."
        />
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
                <TableHead className="text-xs font-medium text-muted-foreground">Tool</TableHead>
                <TableHead className="text-xs font-medium text-muted-foreground">Scopes</TableHead>
                <TableHead className="text-right text-xs font-medium text-muted-foreground">
                  Actions
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
          title="Delete tool"
          confirmLabel="Delete tool"
          message={
            <>
              Remove {toolLabel(deleting.toolKey)}? Agents using it will lose access to this tool.
            </>
          }
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
