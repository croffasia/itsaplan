import { ArrowLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useColumnSearchContext } from '../../context/columnSearchContext';
import { useSearchViewport } from '../../hooks/useSearchViewport';
import { ColumnSearchPanel } from './ColumnSearchPanel';

export function ColumnSearchSurface() {
  const search = useColumnSearchContext();
  const t = useTranslations('workItems.search');
  const viewport = useSearchViewport();
  const open = search.active?.mode === 'modal' && !search.externalOverlayOpen;
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) search.close();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="column-search-surface flex h-dvh max-w-none flex-col gap-3 overflow-hidden rounded-none border-0 p-3 pt-[max(12px,env(safe-area-inset-top))] pb-[max(12px,env(safe-area-inset-bottom))] sm:max-w-none"
        style={viewport ? { top: viewport.top, height: viewport.height } : undefined}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          if (!search.returnToResult.current) search.inputRef.current?.focus();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
        }}
        onEscapeKeyDown={(event) => {
          if (event.isComposing || search.composing.current) event.preventDefault();
        }}
      >
        <header className="shrink-0 space-y-1">
          <Button
            variant="ghost"
            className="min-h-11 justify-start px-2"
            onClick={() => search.close()}
          >
            <ArrowLeft className="rtl:rotate-180" />
            {t('back')}
          </Button>
          <DialogTitle dir="auto" className="px-1 text-base leading-snug break-words">
            {search.group?.name}
          </DialogTitle>
          <DialogDescription dir="auto" className="px-1 text-sm">
            {search.project.project.name} · <bdi>{search.project.project.key}</bdi>
          </DialogDescription>
        </header>
        <ColumnSearchPanel />
      </DialogContent>
    </Dialog>
  );
}
