'use client';

import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import SectionPageView from '@/components/common/page/SectionPageView';
import SectionPreview from '@/components/common/page/SectionPreview';
import { Button } from '@/components/ui/button';
import { useSettingsSectionText } from '@/hooks/useSectionLabels';
import SettingsFormsPreviewEditor from './SettingsFormsPreviewEditor';
import SettingsFormsPreviewList from './SettingsFormsPreviewList';

export default function SettingsFormsPreview() {
  const t = useTranslations('sections.previews.forms');
  const text = useSettingsSectionText()('forms');

  return (
    <SectionPageView
      title={text.label}
      description={text.description}
      actions={
        <Button size="sm" disabled aria-hidden>
          <Plus className="size-3.5" />
          {t('new')}
        </Button>
      }
      wide
    >
      <SectionPreview feature="forms">
        <div className="flex flex-col gap-10">
          <SettingsFormsPreviewList />
          <SettingsFormsPreviewEditor />
        </div>
      </SectionPreview>
    </SectionPageView>
  );
}
