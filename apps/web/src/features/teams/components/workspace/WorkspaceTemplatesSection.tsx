'use client';

import { useState, type ReactNode } from 'react';
import { Import, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useWorkspaceProjectTemplatesQuery } from '@/services/projectTemplates.service';
import { EmptyState } from '@/components/common/page/EmptyState';
import SectionPageView from '@/components/common/page/SectionPageView';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import { Button } from '@/components/ui/button';
import WorkspaceTemplateSaveModal from '../WorkspaceTemplateSaveModal';
import WorkspaceTemplateImportModal from './WorkspaceTemplateImportModal';
import WorkspaceTemplatesTable from './WorkspaceTemplatesTable';

// The project templates of the workspace, which its owner and admins save here or from a
// project's panel in a team's Projects, and a team's owners and managers pick when they
// create a project.
export default function WorkspaceTemplatesSection({ workspaceId }: { workspaceId: number }) {
  const t = useTranslations('teams');
  const { data: templates } = useWorkspaceProjectTemplatesQuery(workspaceId);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const actions = (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="ghost" onClick={() => setImporting(true)}>
        <Import />
        {t('templates.importAction')}
      </Button>
      <Button size="sm" onClick={() => setCreating(true)}>
        <Plus />
        {t('templates.newAction')}
      </Button>
    </div>
  );

  let content: ReactNode;
  if (!templates) {
    content = <ListSkeleton rows={2} rowClassName="h-12" />;
  } else if (templates.length === 0) {
    content = (
      <EmptyState title={t('templates.empty')} description={t('templates.emptyHint')}>
        {actions}
      </EmptyState>
    );
  } else {
    content = <WorkspaceTemplatesTable workspaceId={workspaceId} templates={templates} />;
  }

  return (
    <SectionPageView
      title={t('sections.templates.title')}
      description={t('sections.templates.description')}
      actions={templates?.length ? actions : undefined}
      wide
    >
      {content}
      {creating && (
        <WorkspaceTemplateSaveModal workspaceId={workspaceId} onClose={() => setCreating(false)} />
      )}
      {importing && (
        <WorkspaceTemplateImportModal
          workspaceId={workspaceId}
          onClose={() => setImporting(false)}
        />
      )}
    </SectionPageView>
  );
}
