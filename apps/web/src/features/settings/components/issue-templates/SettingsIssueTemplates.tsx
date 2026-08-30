import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { IssueTemplate, ProjectDetail } from '@/lib/api';
import SettingsConfirmDeleteDialog from '../crud/SettingsConfirmDeleteDialog';
import { SettingsEmpty } from '../crud/SettingsEmpty';
import { SettingsRow } from '../crud/SettingsRow';
import {
  useCreateIssueTemplate,
  useDeleteIssueTemplate,
  useUpdateIssueTemplate,
} from '../../services/settings.service';
import SettingsIssueTemplateDialog from './SettingsIssueTemplateDialog';
import { templateInput, type IssueTemplateFormValues } from '../../utils/issueTemplateForm';

// Project settings tab for issue templates: the presets the create dialog offers.
export default function SettingsIssueTemplates({
  project,
  requestNew,
  onNewHandled,
}: {
  project: ProjectDetail;
  requestNew: boolean;
  onNewHandled: () => void;
}) {
  const t = useTranslations('settings.issueTemplates');
  const projectKey = project.project.key;
  const createTemplate = useCreateIssueTemplate(projectKey);
  const updateTemplate = useUpdateIssueTemplate(projectKey);
  const deleteTemplate = useDeleteIssueTemplate(projectKey);
  const [editing, setEditing] = useState<IssueTemplate | 'new' | null>(null);
  const [deleting, setDeleting] = useState<IssueTemplate | null>(null);

  // The "New template" button lives in the page header; opening is signalled here.
  useEffect(() => {
    if (!requestNew) return;
    setEditing('new');
    onNewHandled();
  }, [requestNew, onNewHandled]);

  const templates = project.issueTemplates;

  async function save(values: IssueTemplateFormValues) {
    if (editing === 'new') {
      await createTemplate.mutateAsync(templateInput(values));
    } else if (editing) {
      await updateTemplate.mutateAsync({ id: editing.id, patch: templateInput(values) });
    }
    setEditing(null);
  }

  return (
    <div>
      {templates.length === 0 ? (
        <SettingsEmpty
          title={t('emptyTitle')}
          description={t('emptyDescription')}
          addLabel={t('addTemplate')}
          onAdd={() => setEditing('new')}
        />
      ) : (
        <div className="divide-y divide-border/50">
          {templates.map((template) => (
            <SettingsRow
              key={template.id}
              title={template.name}
              meta={template.description}
              editTitle={t('editTemplate')}
              deleteTitle={t('deleteTemplate')}
              onEdit={() => setEditing(template)}
              onDelete={() => setDeleting(template)}
            />
          ))}
        </div>
      )}

      {editing && (
        <SettingsIssueTemplateDialog
          project={project}
          initial={editing === 'new' ? undefined : editing}
          onSubmit={(values) => void save(values)}
          onClose={() => setEditing(null)}
        />
      )}

      {deleting && (
        <SettingsConfirmDeleteDialog
          title={t('deleteTitle', { name: deleting.name })}
          confirmLabel={t('deleteTemplate')}
          message={t('deleteMessage')}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await deleteTemplate.mutateAsync(deleting.id);
            setDeleting(null);
          }}
        />
      )}
    </div>
  );
}
