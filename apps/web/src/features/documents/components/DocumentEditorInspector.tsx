'use client';

import type { Editor } from '@tiptap/react';
import type { ProjectDocument } from '@/lib/api';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { useLocale, useTranslations } from 'next-intl';
import DocumentSidePanel from './DocumentSidePanel';

export default function DocumentEditorInspector({
  open,
  projectKey,
  document,
  editor,
  authorNames,
  canUpload,
  canDeleteAssets,
  canReadWorkItems,
  canLinkWorkItems,
  onOpenChange,
  onOpenHistory,
}: {
  open: boolean;
  projectKey: string;
  document: ProjectDocument;
  editor: Editor | null;
  authorNames: Record<string, string>;
  canUpload: boolean;
  canDeleteAssets: boolean;
  canReadWorkItems: boolean;
  canLinkWorkItems: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenHistory: () => void;
}) {
  const t = useTranslations('documents');
  const locale = useLocale();
  const isMobile = useIsMobile();

  if (!open) return null;

  const panel = (
    <DocumentSidePanel
      projectKey={projectKey}
      document={document}
      editor={editor}
      authorNames={authorNames}
      canUpload={canUpload}
      canDeleteAssets={canDeleteAssets}
      canReadWorkItems={canReadWorkItems}
      canLinkWorkItems={canLinkWorkItems}
      onOpenHistory={onOpenHistory}
    />
  );

  if (isMobile) {
    return (
      <Sheet open onOpenChange={onOpenChange}>
        <SheetContent
          side={locale === 'ar' ? 'left' : 'right'}
          className="w-[min(94vw,380px)] gap-0 sm:max-w-[380px]"
        >
          <SheetHeader className="shrink-0 border-b pe-12">
            <SheetTitle>{t('details')}</SheetTitle>
            <SheetDescription className="sr-only">{t('detailsDescription')}</SheetDescription>
          </SheetHeader>
          {panel}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <aside
      className="flex w-[21rem] shrink-0 animate-in flex-col border-s bg-muted/10 duration-200 slide-in-from-right"
      aria-label={t('details')}
    >
      {panel}
    </aside>
  );
}
