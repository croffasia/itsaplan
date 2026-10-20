'use client';

import AuditLogPreview from '@/components/common/page/AuditLogPreview';
import SectionPreview from '@/components/common/page/SectionPreview';
import GodSectionPage from './components/GodSectionPage';

export default function GodAuditLogPage() {
  return (
    <GodSectionPage slug="audit-log" widthClassName="max-w-none">
      <SectionPreview>
        <AuditLogPreview />
      </SectionPreview>
    </GodSectionPage>
  );
}
