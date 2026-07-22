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
      description="Let AI agents work with this project over the Model Context Protocol: every issue and board action they can reach with your access."
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
