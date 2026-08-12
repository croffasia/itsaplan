import Image from 'next/image';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { type Embeddable } from '../../utils/attachmentEmbed';
import { useTranslations } from 'next-intl';

// Nothing here may take focus: blurring the editor saves the description, and the
// refetched updatedAt remounts the editor by its key — mid-pick, throwing away the
// insert.
export default function EditorImagePicker({
  open,
  images,
  onClose,
  onPick,
}: {
  open: boolean;
  images: Embeddable[];
  onClose: () => void;
  onPick: (image: Embeddable) => void;
}) {
  const t = useTranslations('issue.editor');
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="sm:max-w-lg"
        // Leaving focus in the editor also keeps the cursor the pick inserts at.
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{t('insertImage')}</DialogTitle>
        </DialogHeader>
        {images.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('noImages')}</p>
        ) : (
          <div className="grid max-h-[60vh] grid-cols-3 gap-2 overflow-y-auto">
            {images.map((a) => (
              <button
                key={a.url}
                type="button"
                title={a.filename}
                aria-label={t('insertNamed', { name: a.filename })}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onPick(a)}
                className="relative aspect-square overflow-hidden rounded-md border hover:border-primary"
              >
                <Image
                  src={a.url}
                  alt={a.filename}
                  fill
                  // A grid cell is at most a third of the dialog's 32rem.
                  sizes="176px"
                  className="object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
