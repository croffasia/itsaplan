'use client';

import { useRef, useState } from 'react';
import { Plus, SlidersHorizontal, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ProjectDocumentSummary } from '@/lib/api/endpoints/documents';
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useDocumentsRailView } from '../../hooks/useDocumentsRailView';
import DocumentIconButton from '../DocumentIconButton';
import DocumentsRailTreeToggle from './DocumentsRailTreeToggle';
import DocumentsRailViewMenu from './DocumentsRailViewMenu';

// The popover spans the rail under its header rather than hanging off the button.
export default function DocumentsRailHeader({
  projectKey,
  count,
  documents,
  showTools,
  canCreate,
  creating,
  onCreate,
  onUpload,
}: {
  projectKey: string;
  count: number | null;
  documents: ProjectDocumentSummary[];
  showTools: boolean;
  canCreate: boolean;
  creating: boolean;
  onCreate: () => void;
  onUpload: (file: File) => void;
}) {
  const t = useTranslations('documents');
  const { filterCount } = useDocumentsRailView(projectKey);
  const [open, setOpen] = useState(false);
  const uploadInput = useRef<HTMLInputElement>(null);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className="flex h-12 shrink-0 items-center gap-1.5 ps-4 pe-2">
          <h2 className="text-sm font-semibold tracking-[-0.01em]">{t('title')}</h2>
          {count !== null && (
            <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
          )}
          {showTools && (
            <div className="ms-auto flex gap-0.5">
              <DocumentsRailTreeToggle projectKey={projectKey} documents={documents} />
              <PopoverTrigger asChild>
                <DocumentIconButton
                  label={
                    filterCount > 0
                      ? t('sortAndFilterActive', { count: filterCount })
                      : t('sortAndFilter')
                  }
                  title={t('sortAndFilter')}
                  className={cn(filterCount > 0 && 'w-auto gap-1 px-2')}
                >
                  <SlidersHorizontal />
                  {filterCount > 0 && (
                    <span className="text-[11px] tabular-nums">{filterCount}</span>
                  )}
                </DocumentIconButton>
              </PopoverTrigger>
              {canCreate && (
                <>
                  <input
                    ref={uploadInput}
                    hidden
                    type="file"
                    accept=".md,.markdown,text/markdown"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.currentTarget.value = '';
                      if (file) onUpload(file);
                    }}
                  />
                  <DocumentIconButton
                    label={t('uploadMarkdown')}
                    disabled={creating}
                    onClick={() => uploadInput.current?.click()}
                  >
                    <Upload />
                  </DocumentIconButton>
                  <DocumentIconButton
                    label={t('newDocument')}
                    disabled={creating}
                    onClick={onCreate}
                  >
                    <Plus />
                  </DocumentIconButton>
                </>
              )}
            </div>
          )}
        </div>
      </PopoverAnchor>
      <PopoverContent align="center" sideOffset={-4} className="w-64 rounded-lg p-1">
        <DocumentsRailViewMenu
          projectKey={projectKey}
          documents={documents}
          onClose={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
}
