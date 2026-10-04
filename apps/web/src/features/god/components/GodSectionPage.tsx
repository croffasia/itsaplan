import type { ReactNode } from 'react';
import { GodSectionExtras } from '@/cloud';
import { useGodSectionText } from '@/hooks/useSectionLabels';
import SectionPageView from '@/components/common/page/SectionPageView';

// The chrome shared by every god section page: title and description taken from the
// section entry, and below the content what the hosted build adds to the section. The
// directory pages pass a `widthClassName` that spans the whole shell, because their
// tables are wide.
export default function GodSectionPage({
  slug,
  actions,
  widthClassName,
  children,
}: {
  slug: string;
  actions?: ReactNode;
  widthClassName?: string;
  children: ReactNode;
}) {
  const section = useGodSectionText().section(slug);
  return (
    <SectionPageView
      title={section.label}
      description={section.description}
      widthClassName={widthClassName}
      actions={actions}
    >
      {children}
      <GodSectionExtras slug={slug} />
    </SectionPageView>
  );
}
