'use client';

import { useRef } from 'react';
import { LoaderCircle, Plus, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

// Without actions for a viewer who may not create pages.
export default function DocumentsHomeHeader({
  subtitle,
  actions,
}: {
  subtitle: string;
  actions?: { creating: boolean; onCreate: () => void; onUpload: (file: File) => void };
}) {
  const t = useTranslations('documents');
  const uploadInput = useRef<HTMLInputElement>(null);

  return (
    <header className="flex flex-wrap items-end gap-4">
      <div className="min-w-0">
        <h1 className="text-[28px] leading-[1.15] font-semibold tracking-[-0.025em]">
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground" dir="auto">
          {subtitle}
        </p>
      </div>
      {actions && (
        <div className="ms-auto flex gap-2">
          <input
            ref={uploadInput}
            className="sr-only"
            type="file"
            accept=".md,.markdown,text/markdown"
            aria-label={t('uploadMarkdown')}
            tabIndex={-1}
            disabled={actions.creating}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.currentTarget.value = '';
              if (file) actions.onUpload(file);
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            disabled={actions.creating}
            onClick={() => uploadInput.current?.click()}
          >
            <Upload />
            <span className="max-md:sr-only">{t('uploadMarkdown')}</span>
          </Button>
          <Button
            type="button"
            size="sm"
            className="shadow-none"
            disabled={actions.creating}
            onClick={actions.onCreate}
          >
            {actions.creating ? <LoaderCircle className="animate-spin" /> : <Plus />}
            <span className="max-md:sr-only">{t('newDocument')}</span>
          </Button>
        </div>
      )}
    </header>
  );
}
