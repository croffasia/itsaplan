'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { usePermissions } from '@/hooks/usePermissions';
import { aiAgentsPath } from '@/utils/paths';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/common/page/EmptyState';

// What the panel shows for a project with no agent: there is nobody to chat with, so
// there is no composer either.
export function ChatPanelEmpty({ projectKey }: { projectKey: string }) {
  const t = useTranslations('aiChat');
  const { can } = usePermissions();

  return (
    <div className="flex h-full flex-col">
      <EmptyState title={t('emptyTitle')} description={t('emptyDescription')}>
        {can('ai_agents', 'edit') && (
          <Button asChild size="sm">
            <Link href={aiAgentsPath(projectKey)}>{t('createAgent')}</Link>
          </Button>
        )}
      </EmptyState>
    </div>
  );
}
