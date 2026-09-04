import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { IssueTemplate, ProjectDetail } from '@/lib/api';
import Modal from '@/components/common/overlay/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import IssueTemplateProperties from './IssueTemplateProperties';
import { templateFormValues, type IssueTemplateFormValues } from '../../utils/issueTemplateForm';

// The dialog that adds or edits one issue template: how it is named in the picker,
// the title and description the issue starts with, and the properties applied on
// top of them. Everything a template presets stays editable in the create dialog.
export default function SettingsIssueTemplateDialog({
  project,
  initial,
  onSubmit,
  onClose,
}: {
  project: ProjectDetail;
  // The template being edited; absent while adding one.
  initial?: IssueTemplate;
  onSubmit: (values: IssueTemplateFormValues) => void;
  onClose: () => void;
}) {
  const t = useTranslations('settings.issueTemplates');
  const tCommon = useTranslations('common');
  const [values, setValues] = useState(() => templateFormValues(initial));

  function change(patch: Partial<IssueTemplateFormValues>) {
    setValues((prev) => ({ ...prev, ...patch }));
  }

  return (
    <Modal title={t(initial ? 'editTemplate' : 'addTemplate')} onClose={onClose} wide>
      <form
        className="space-y-8"
        onSubmit={(event) => {
          event.preventDefault();
          if (values.name.trim()) onSubmit(values);
        }}
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="issue-template-name">{tCommon('name')}</Label>
            <Input
              id="issue-template-name"
              autoFocus
              required
              value={values.name}
              onChange={(e) => change({ name: e.target.value })}
              placeholder={t('namePlaceholder')}
              className="h-9"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="issue-template-description">{tCommon('description')}</Label>
            <Input
              id="issue-template-description"
              value={values.description}
              onChange={(e) => change({ description: e.target.value })}
              placeholder={t('descriptionPlaceholder')}
              className="h-9"
            />
          </div>
        </div>

        <div className="space-y-4 border-t border-border/50 pt-5">
          <div className="space-y-1.5">
            <Label htmlFor="issue-template-title">{t('issueTitle')}</Label>
            <Input
              id="issue-template-title"
              dir="auto"
              value={values.titleTemplate}
              onChange={(e) => change({ titleTemplate: e.target.value })}
              placeholder={t('issueTitlePlaceholder')}
              className="h-9"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="issue-template-body">{t('issueDescription')}</Label>
            <Textarea
              id="issue-template-body"
              dir="auto"
              rows={8}
              value={values.descriptionTemplate}
              onChange={(e) => change({ descriptionTemplate: e.target.value })}
              placeholder={t('issueDescriptionPlaceholder')}
            />
          </div>
        </div>

        <div className="border-t border-border/50 pt-5">
          <IssueTemplateProperties project={project} values={values} onChange={change} />
        </div>

        <div className="flex justify-end gap-2 border-t border-border/50 pt-5">
          <Button type="button" variant="ghost" onClick={onClose}>
            {tCommon('cancel')}
          </Button>
          <Button type="submit" disabled={!values.name.trim()}>
            {tCommon(initial ? 'save' : 'add')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
