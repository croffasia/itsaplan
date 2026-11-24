'use client';

import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useDocumentCreate } from '../../hooks/useDocumentCreate';
import DocumentsHomeEmptyTiles from './DocumentsHomeEmptyTiles';
import DocumentsHomeHeader from './DocumentsHomeHeader';

const STARTERS = ['handbook', 'specs', 'meetings', 'decisions', 'onboarding'] as const;

// The home of a project with no pages: ways to write the first one.
export default function DocumentsHomeEmpty({
  projectKey,
  projectName,
  canCreate,
  creating,
  onCreate,
  onUpload,
}: {
  projectKey: string;
  projectName: string;
  canCreate: boolean;
  creating: boolean;
  onCreate: () => void;
  onUpload: (file: File) => void;
}) {
  const t = useTranslations('documents');
  const starter = useDocumentCreate(projectKey);
  const busy = creating || starter.creating;

  return (
    <>
      <DocumentsHomeHeader subtitle={projectName} />
      <section aria-labelledby="documents-home-empty" className="flex flex-col gap-6">
        <div>
          <h2
            id="documents-home-empty"
            className="mb-1.5 text-[22px] leading-[1.3] font-semibold tracking-[-0.015em]"
          >
            {t('emptyTitle')}
          </h2>
          <p className="max-w-[52ch] text-[15px] text-muted-foreground">
            {canCreate ? t('emptyDescription') : t('home.emptyReadOnly')}
          </p>
        </div>
        {canCreate && (
          <>
            <DocumentsHomeEmptyTiles
              busy={busy}
              onCreate={onCreate}
              onCreatePrivate={() => void starter.create({ parentId: null, isPrivate: true })}
              onUpload={onUpload}
            />
            <div className="flex max-w-[1080px] flex-wrap items-center gap-2">
              <h3 className="mt-2 mb-1 w-full text-[13px] font-medium text-muted-foreground">
                {t('home.startersTitle')}
              </h3>
              {STARTERS.map((key) => (
                <button
                  key={key}
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void starter.create({ parentId: null, title: t(`home.starters.${key}`) })
                  }
                  className="inline-flex h-8 items-center gap-1.5 rounded-full bg-muted/70 ps-2.5 pe-3 text-[13px] font-medium transition-colors outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                >
                  <Plus className="size-3.5 text-muted-foreground" />
                  {t(`home.starters.${key}`)}
                </button>
              ))}
            </div>
          </>
        )}
      </section>
    </>
  );
}
