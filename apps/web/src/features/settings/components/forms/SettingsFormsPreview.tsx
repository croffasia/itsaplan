'use client';

import SectionPageView from '@/components/common/page/SectionPageView';
import SectionPreview from '@/components/common/page/SectionPreview';
import { useSettingsSectionText } from '@/hooks/useSectionLabels';
import SettingsFormsPreviewEditor from './SettingsFormsPreviewEditor';
import SettingsFormsPreviewList from './SettingsFormsPreviewList';

export default function SettingsFormsPreview() {
  const text = useSettingsSectionText()('forms');

  return (
    <SectionPageView title={text.label} description={text.description} wide>
      <SectionPreview>
        <div className="flex flex-col gap-10">
          <SettingsFormsPreviewList />
          <SettingsFormsPreviewEditor />
        </div>
      </SectionPreview>
    </SectionPageView>
  );
}
