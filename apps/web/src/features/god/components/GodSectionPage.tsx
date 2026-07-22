import type { ReactNode } from 'react';
import { godSection } from '@/utils/godSections';
import SectionPageView from '@/components/common/page/SectionPageView';

// The chrome shared by every god section page: title and description taken from the
// section entry. `widthClassName` defaults to the settings column; the directory
// pages override it to span the whole shell, because their tables are wide.
export default function GodSectionPage({
  slug,
  actions,
  widthClassName = 'min-w-[600px] max-w-[60%]',
  children,
}: {
  slug: string;
  actions?: ReactNode;
  widthClassName?: string;
  children: ReactNode;
}) {
  const section = godSection(slug);
  return (
    <SectionPageView
      title={section.label}
      description={section.description}
      wide
      widthClassName={widthClassName}
      actions={actions}
    >
      {children}
    </SectionPageView>
  );
}
