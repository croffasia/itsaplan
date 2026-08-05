import { useRef } from 'react';
import { Upload } from 'lucide-react';
import type { StorageSettings } from '@/lib/api';
import { attachmentAccept, attachmentLimitHint } from '@/utils/uploadLimits';
import { Button } from '@/components/ui/button';

export default function FilesUploadButton({
  limits,
  uploading,
  onFiles,
}: {
  limits: StorageSettings | undefined;
  uploading: boolean;
  onFiles: (files: FileList) => void;
}) {
  const input = useRef<HTMLInputElement>(null);

  return (
    <>
      <Button
        size="sm"
        disabled={uploading}
        title={attachmentLimitHint(limits)}
        onClick={() => input.current?.click()}
      >
        <Upload />
        {uploading ? 'Uploading…' : 'Upload files'}
      </Button>
      <input
        ref={input}
        type="file"
        multiple
        accept={attachmentAccept(limits)}
        className="hidden"
        onChange={(event) => {
          if (event.target.files) onFiles(event.target.files);
          event.target.value = '';
        }}
      />
    </>
  );
}
