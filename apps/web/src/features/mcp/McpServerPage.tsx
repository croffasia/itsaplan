'use client';

import { useTranslations } from 'next-intl';
import { useShell } from '@/context/shellContext';
import SectionPageView from '@/components/common/page/SectionPageView';
import McpAccessNotice from './components/McpAccessNotice';
import McpAuthConfiguration from './components/McpAuthConfiguration';

export default function McpServerPage() {
  const t = useTranslations('mcp');
  const { project } = useShell();
  const detail = project?.project ?? null;
  const reachable = detail != null && detail.mcpEnabled && detail.teamMcpEnabled;

  return (
    <SectionPageView
      title={t('title')}
      description={t('description')}
      wide
      widthClassName="min-w-[600px] max-w-[60%]"
    >
      <div className="space-y-10">
        {detail && !reachable && (
          <McpAccessNotice
            teamId={detail.teamId}
            teamName={detail.teamName}
            teamRole={project?.viewer.teamRole ?? null}
            teamMcpEnabled={detail.teamMcpEnabled}
          />
        )}
        {reachable && <McpAuthConfiguration />}
      </div>
    </SectionPageView>
  );
}
