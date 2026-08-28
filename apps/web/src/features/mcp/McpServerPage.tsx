'use client';

import { useTranslations } from 'next-intl';
import { useShell } from '@/context/shellContext';
import { usePermissions } from '@/hooks/usePermissions';
import SectionPageView from '@/components/common/page/SectionPageView';
import McpStatusRow from './components/McpStatusRow';
import McpAuthConfiguration from './components/McpAuthConfiguration';

export default function McpServerPage() {
  const t = useTranslations('mcp');
  const { project } = useShell();
  const { isOwner } = usePermissions();

  return (
    <SectionPageView
      title={t('title')}
      description={t('description')}
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
        <McpAuthConfiguration />
      </div>
    </SectionPageView>
  );
}
