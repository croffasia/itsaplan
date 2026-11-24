import { useTranslations } from 'next-intl';
import type { DocumentAsset } from '@/lib/api/endpoints/documents';

// The images already uploaded to the page, to insert one again.
export default function DocumentImageLibrary({
  loading,
  images,
  onInsert,
}: {
  loading: boolean;
  images: DocumentAsset[];
  onInsert: (asset: DocumentAsset) => void;
}) {
  const t = useTranslations('documents.toolbar');

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-1.5 px-1" aria-hidden>
        {Array.from({ length: 2 }, (_, index) => (
          <div key={index} className="aspect-[4/3] animate-pulse rounded-md bg-muted" />
        ))}
      </div>
    );
  }
  if (images.length === 0) {
    return <p className="p-2 text-[13px] text-muted-foreground">{t('noImages')}</p>;
  }
  return (
    <div className="grid max-h-56 grid-cols-2 gap-1.5 overflow-y-auto p-1">
      {images.map((asset) => (
        <button
          key={asset.id}
          type="button"
          className="overflow-hidden rounded-md bg-muted outline-offset-1 hover:outline-2 hover:outline-ring focus-visible:outline-2 focus-visible:outline-ring"
          title={t('insertImage', { name: asset.filename })}
          aria-label={t('insertImage', { name: asset.filename })}
          onClick={() => onInsert(asset)}
        >
          {/* Chrome adds a dragged <img> to the drop as a file, which the editor would upload
              again as a new asset. */}
          {/* eslint-disable-next-line @next/next/no-img-element -- private media uses the session-gated proxy. */}
          <img
            src={asset.url}
            alt=""
            draggable={false}
            className="aspect-[4/3] w-full object-cover"
          />
        </button>
      ))}
    </div>
  );
}
