'use client';

import { useShell } from '@/context/shellContext';
import { usePermissions } from '@/hooks/usePermissions';
import SectionPageView from '@/components/common/page/SectionPageView';
import McpStatusRow from './components/McpStatusRow';
import McpConnectionGuide from './components/McpConnectionGuide';

export default function McpServerPage() {
  const { project } = useShell();
  const { isOwner } = usePermissions();

  return (
    <SectionPageView
      title="MCP Server"
      description="Connect AI agents to this project over the Model Context Protocol. An agent gets the access of the API key it uses."
      wide
      widthClassName="min-w-[600px] max-w-[60%]"
    >
      <div className="space-y-10">
        <McpStatusRow
          projectKey={project?.project.key ?? ''}
          enabled={project?.project.mcpEnabled ?? false}
          isLoading={!project}
          canManage={isOwner}
        />
        <McpConnectionGuide />
      </div>
    </SectionPageView>
  );
}
