import { useRef } from 'react';
import { ImagePlus, LoaderCircle } from 'lucide-react';
import type { StorageSettings } from '@/lib/api';
import { Button } from '@/components/ui/button';

export default function NoteImageUploadButton({
  limits,
  uploading,
  onFiles,
}: {
  limits: StorageSettings | undefined;
  uploading: boolean;
  onFiles: (files: FileList) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const hint = limits
    ? `JPEG, PNG, WebP, or GIF. Up to ${limits.maxAttachmentMb} MB per photo.`
    : 'JPEG, PNG, WebP, or GIF.';

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        disabled={uploading}
        title={hint}
        onClick={() => input.current?.click()}
      >
        {uploading ? <LoaderCircle className="size-4 animate-spin" /> : <ImagePlus />}
        {uploading ? 'Uploading…' : 'Add photo'}
      </Button>
      <input
        ref={input}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(event) => {
          if (event.target.files) onFiles(event.target.files);
          event.target.value = '';
        }}
      />
    </>
  );
}
