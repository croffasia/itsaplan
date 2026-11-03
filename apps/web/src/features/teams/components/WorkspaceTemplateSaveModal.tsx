'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  useProjectTemplatePreviewQuery,
  useSaveProjectTemplate,
} from '@/services/projectTemplates.service';
import { useCopyColumns } from '@/hooks/useCopyColumns';
import { includeOf, type CopyInclude } from '@/utils/copyOptions';
import CopyProjectOptions from '@/components/layout/CopyProjectOptions';
import WorkspaceTemplateDialog from './WorkspaceTemplateDialog';
import WorkspaceTemplateFields, {
  templateFieldsComplete,
  type WorkspaceTemplateFieldsValue,
} from './WorkspaceTemplateFields';
import WorkspaceTemplatePreview from './WorkspaceTemplatePreview';
import WorkspaceTemplateSource from './WorkspaceTemplateSource';

// Saves the chosen parts of a project's configuration as a template of the workspace.
// Opened from a project, it saves that one; opened from the workspace, the team and the
// project are picked first. Only what a template carries is offered.
export default function WorkspaceTemplateSaveModal({
  workspaceId,
  project,
  onClose,
}: {
  workspaceId: number;
  project?: { id: number; name: string; description: string };
  onClose: () => void;
}) {
  const t = useTranslations('projects.saveTemplate');
  const [teamId, setTeamId] = useState<number | null>(null);
  const [projectId, setProjectId] = useState<number | null>(project?.id ?? null);
  const [fields, setFields] = useState<WorkspaceTemplateFieldsValue>({
    name: project?.name ?? '',
    description: project?.description ?? '',
    teamIds: null,
  });
  // A picked project names the template until the name is edited.
  const [nameEdited, setNameEdited] = useState(false);
  const columns = useCopyColumns(true);
  const [include, setInclude] = useState<CopyInclude>({});
  const selected = includeOf(columns, include);
  const preview = useProjectTemplatePreviewQuery(workspaceId, projectId, selected);
  const save = useSaveProjectTemplate(workspaceId);

  function submit() {
    if (projectId === null) return;
    save.mutate(
      {
        projectId,
        name: fields.name.trim(),
        description: fields.description.trim(),
        include: selected,
        teamIds: fields.teamIds ?? undefined,
      },
      {
        onSuccess: (template) => {
          toast.success(t('saved', { name: template.name }));
          onClose();
        },
      },
    );
  }

  return (
    <WorkspaceTemplateDialog
      title={project ? t('title', { name: project.name }) : t('newTitle')}
      onClose={onClose}
      canSave={!save.isPending && projectId !== null && templateFieldsComplete(fields)}
      onSave={submit}
      form={
        <>
          <p className="text-sm text-muted-foreground">{t('hint')}</p>
          {!project && (
            <WorkspaceTemplateSource
              workspaceId={workspaceId}
              teamId={teamId}
              projectId={projectId}
              onTeamChange={(next) => {
                setTeamId(next);
                setProjectId(null);
              }}
              onProjectChange={(picked) => {
                setProjectId(picked.id);
                if (!nameEdited) setFields({ ...fields, name: picked.name });
              }}
            />
          )}
          <WorkspaceTemplateFields
            workspaceId={workspaceId}
            autoFocus={!!project}
            value={fields}
            onChange={(next) => {
              if (next.name !== fields.name) setNameEdited(next.name !== '');
              setFields(next);
            }}
          />
          <CopyProjectOptions columns={[columns.flat()]} value={include} onChange={setInclude} />
        </>
      }
      preview={
        projectId === null ? (
          <p className="text-sm text-muted-foreground">{t('previewEmpty')}</p>
        ) : (
          <WorkspaceTemplatePreview
            name={fields.name.trim()}
            description={fields.description.trim()}
            contents={preview.data}
          />
        )
      }
    />
  );
}
