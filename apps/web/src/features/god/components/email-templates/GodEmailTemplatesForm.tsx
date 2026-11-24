'use client';

import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { EmailTemplatesSettings } from '@/lib/api/endpoints/god';
import GodSectionPage from '../GodSectionPage';
import GodEmailLayoutEditor from './GodEmailLayoutEditor';
import GodEmailPreview from './GodEmailPreview';
import GodEmailTemplatePicker from './GodEmailTemplatePicker';
import GodEmailTextEditor from './GodEmailTextEditor';
import {
  useGodEmailTemplatesForm,
  type EmailSelection,
} from '../../hooks/useGodEmailTemplatesForm';

export default function GodEmailTemplatesForm({
  settings,
  selection,
  onSelect,
}: {
  settings: EmailTemplatesSettings;
  selection: EmailSelection;
  onSelect: (patch: Partial<EmailSelection>) => void;
}) {
  const t = useTranslations('god.emailTemplates');
  const tCommon = useTranslations('common');
  const form = useGodEmailTemplatesForm(settings);
  const blocked =
    form.hasBlankText || form.hasUnknownVariables || form.missingPlaceholders.length > 0;

  let status = t('unsaved');
  if (form.hasUnknownVariables) status = t('removeUnknownVariables');
  if (form.hasBlankText) status = t('blankText');

  async function save() {
    try {
      await form.save();
      toast.success(t('saved'));
    } catch {
      // The failure already surfaced through the global mutation error toast.
    }
  }

  return (
    <GodSectionPage
      slug="email-templates"
      widthClassName="max-w-none"
      actions={
        <div className="flex items-center gap-3">
          {form.dirty && <span className="text-xs text-muted-foreground">{status}</span>}
          <Button
            size="sm"
            onClick={() => void save()}
            disabled={!form.dirty || blocked || form.saving}
          >
            {form.saving ? tCommon('saving') : tCommon('save')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        <Tabs
          value={selection.tab}
          onValueChange={(tab) => onSelect({ tab: tab as EmailSelection['tab'] })}
        >
          <TabsList>
            <TabsTrigger value="emails">{t('emails')}</TabsTrigger>
            <TabsTrigger value="layout">{t('layout')}</TabsTrigger>
          </TabsList>
        </Tabs>

        {selection.tab === 'emails' && (
          <GodEmailTemplatePicker form={form} selection={selection} onSelect={onSelect} />
        )}

        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,3fr)]">
          {selection.tab === 'emails' ? (
            <GodEmailTextEditor form={form} selection={selection} onSelect={onSelect} />
          ) : (
            <GodEmailLayoutEditor form={form} selection={selection} />
          )}
          <GodEmailPreview form={form} selection={selection} />
        </div>
      </div>
    </GodSectionPage>
  );
}
