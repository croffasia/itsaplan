import { Upload } from 'lucide-react';

export default function FilesDropOverlay({ count }: { count: number }) {
  return (
    <div className="pointer-events-none absolute inset-3 z-30 flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-primary bg-background/90 text-primary backdrop-blur-sm">
      <Upload className="size-7" />
      <span className="text-sm font-medium">
        Drop {count === 1 ? 'file' : `${count} files`} to upload
      </span>
    </div>
  );
}
