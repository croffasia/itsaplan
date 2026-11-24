'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { ProjectTemplate } from '@/lib/api/endpoints/project-templates';
import {
  useProjectTemplateQuery,
  useUpdateProjectTemplate,
} from '@/services/projectTemplates.service';
import WorkspaceTemplateDialog from '../WorkspaceTemplateDialog';
import WorkspaceTemplateFields, {
  templateFieldsComplete,
  type WorkspaceTemplateFieldsValue,
} from '../WorkspaceTemplateFields';
import WorkspaceTemplatePreview from '../WorkspaceTemplatePreview';

// Edits the name, the description and the teams of a template of the workspace. What it
// holds stays as saved.
export default function WorkspaceTemplateEditModal({
  workspaceId,
  template,
  onClose,
}: {
  workspaceId: number;
  template: ProjectTemplate;
  onClose: () => void;
}) {
  const t = useTranslations('teams.templates');
  const [fields, setFields] = useState<WorkspaceTemplateFieldsValue>({
    name: template.name,
    description: template.description,
    teamIds: template.teamIds,
  });
  const { data: saved } = useProjectTemplateQuery({ workspaceId }, template.id);
  const update = useUpdateProjectTemplate(workspaceId);

  function submit() {
    update.mutate(
      {
        templateId: template.id,
        patch: {
          name: fields.name.trim(),
          description: fields.description.trim(),
          teamIds: fields.teamIds,
        },
      },
      { onSuccess: onClose },
    );
  }

  return (
    <WorkspaceTemplateDialog
      title={t('editAction')}
      crumb={template.name}
      onClose={onClose}
      canSave={!update.isPending && templateFieldsComplete(fields)}
      onSave={submit}
      form={
        <>
          <p className="text-sm text-muted-foreground">{t('editHint')}</p>
          <WorkspaceTemplateFields
            workspaceId={workspaceId}
            autoFocus
            value={fields}
            onChange={setFields}
          />
        </>
      }
      preview={
        <WorkspaceTemplatePreview
          name={fields.name.trim()}
          description={fields.description.trim()}
          contents={saved}
        />
      }
    />
  );
}
