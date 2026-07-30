import { Paperclip } from 'lucide-react';

// Covers the whole modal while files are dragged over it, stating where they
// land. pointer-events-none so the drag events keep reaching the modal below.
export default function NewIssueDropOverlay({ count }: { count: number }) {
  let label: string;
  if (count === 1) label = 'Drop the file';
  else if (count > 1) label = `Drop ${count} files`;
  // A drag does not always expose its items, leaving the count at 0.
  else label = 'Drop files';

  return (
    <div className="pointer-events-none absolute inset-0 z-50 flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-primary bg-background/80 text-primary backdrop-blur-sm">
      <Paperclip className="size-6" />
      <span className="text-sm font-medium">{label}</span>
      <span className="text-xs text-muted-foreground">
        Added to the description and attached to the issue
      </span>
    </div>
  );
}
