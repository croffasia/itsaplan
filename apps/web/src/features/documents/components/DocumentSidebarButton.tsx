'use client';

import { PanelLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useSidebar } from '@/components/ui/sidebar';
import { useDocumentsRail } from '../context/documentsRail';
import DocumentIconButton from './DocumentIconButton';

// On the Docs page the button hides and shows the page tree: beside the page on a wide screen,
// as a drawer on a narrow one. The inbox shows a page without the tree, so there it collapses
// the app sidebar.
export default function DocumentSidebarButton() {
  const t = useTranslations('documents');
  const { state, toggleSidebar } = useSidebar();
  const rail = useDocumentsRail();

  if (!rail) {
    const collapsed = state === 'collapsed';
    return (
      <DocumentIconButton
        label={collapsed ? t('expandSidebar') : t('collapseSidebar')}
        aria-pressed={collapsed}
        className="max-md:hidden"
        onClick={toggleSidebar}
      >
        <PanelLeft className="rtl:-scale-x-100" />
      </DocumentIconButton>
    );
  }

  return (
    <>
      <DocumentIconButton
        label={rail.shown ? t('hidePages') : t('showPages')}
        aria-pressed={!rail.shown}
        className="max-md:hidden"
        onClick={rail.toggleShown}
      >
        <PanelLeft className="rtl:-scale-x-100" />
      </DocumentIconButton>
      <DocumentIconButton
        label={t('showPages')}
        className="md:hidden"
        onClick={() => rail.setOpen(true)}
      >
        <PanelLeft className="rtl:-scale-x-100" />
      </DocumentIconButton>
    </>
  );
}
