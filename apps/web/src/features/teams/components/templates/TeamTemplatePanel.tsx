'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LayoutTemplate, Plus, Trash2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ProjectTemplate } from '@/lib/api/endpoints/project-templates';
import { projectPath } from '@/utils/paths';
import { useExitOnEscape } from '@/hooks/useExitOnEscape';
import ProjectTemplateDetails from '@/components/common/project-template/ProjectTemplateDetails';
import NewProjectModal from '@/components/layout/NewProjectModal';
import { Button } from '@/components/ui/button';

// One template of the team in a right-hand side panel, the surface a project of the
// team opens in: what it is, what a project created from it starts with, and a project
// to create from it. Escape or a backdrop click closes it.
export default function TeamTemplatePanel({
  teamId,
  template,
  onDelete,
  onClose,
}: {
  teamId: number;
  template: ProjectTemplate;
  onDelete: () => void;
  onClose: () => void;
}) {
  const t = useTranslations('teams');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  useExitOnEscape(onClose);

  return (
    <div
      className="fixed inset-0 z-40 flex bg-black/20"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="ms-auto flex h-full w-full flex-col border-s bg-card sm:w-[680px] sm:max-w-[92vw]">
        <div className="flex shrink-0 items-center justify-between gap-3 bg-muted/30 px-6 py-4">
          <div className="flex min-w-0 items-center gap-2">
            <LayoutTemplate className="size-4 shrink-0 text-muted-foreground" />
            <h2 className="truncate text-base font-semibold" dir="auto">
              {template.name}
            </h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 shrink-0"
            onClick={onClose}
            title={tCommon('close')}
          >
            <X />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <ProjectTemplateDetails teamId={teamId} template={template} />
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t px-6 py-3">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 />
            {t('templates.deleteAction')}
          </Button>
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus />
            {t('panel.newProject')}
          </Button>
        </div>
      </div>

      {creating && (
        <NewProjectModal
          teamId={teamId}
          initialTemplateId={template.id}
          onClose={() => setCreating(false)}
          onCreated={(key) => router.push(projectPath(key))}
        />
      )}
    </div>
  );
}
