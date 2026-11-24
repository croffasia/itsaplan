'use client';

import { Clipboard, Download, History } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { copyText } from '@/utils/clipboard';

// The page actions open to everyone who can read the page.
export default function DocumentReadMenuItems({
  content,
  onExport,
  onOpenHistory,
}: {
  content: () => string;
  onExport: () => void;
  onOpenHistory: () => void;
}) {
  const t = useTranslations('documents');

  return (
    <>
      <DropdownMenuItem
        onSelect={() =>
          void copyText(content()).then((copied) => {
            if (copied) toast.success(t('markdownCopied'));
          })
        }
      >
        <Clipboard />
        {t('copyMarkdown')}
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={onExport}>
        <Download />
        {t('export')}
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={onOpenHistory}>
        <History />
        {t('versionHistory')}
      </DropdownMenuItem>
    </>
  );
}
