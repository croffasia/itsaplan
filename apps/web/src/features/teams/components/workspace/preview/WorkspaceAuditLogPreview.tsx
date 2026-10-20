'use client';

import { useTranslations } from 'next-intl';
import AuditLogPreview from '@/components/common/page/AuditLogPreview';
import SectionPageView from '@/components/common/page/SectionPageView';
import SectionPreview from '@/components/common/page/SectionPreview';

export default function WorkspaceAuditLogPreview() {
  const t = useTranslations('sections.previews.auditLog');

  return (
    <SectionPageView title={t('title')} description={t('description')} wide>
      <SectionPreview>
        <AuditLogPreview />
      </SectionPreview>
    </SectionPageView>
  );
}
