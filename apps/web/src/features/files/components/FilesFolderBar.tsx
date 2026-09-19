'use client';

import { ChevronLeft, Folder } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Folders are a grouping of the flat file list, so the bar shows the folders of
// the root and, inside one, the way back out.
export default function FilesFolderBar({
  folder,
  folders,
  onOpen,
}: {
  folder: string;
  folders: { name: string; count: number }[];
  onOpen: (folder: string) => void;
}) {
  if (folder) {
    return (
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => onOpen('')}>
          <ChevronLeft className="size-4" />
          All files
        </Button>
        <span className="text-sm font-medium">{folder}</span>
      </div>
    );
  }

  if (folders.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {folders.map((entry) => (
        <Button
          key={entry.name}
          variant="outline"
          size="sm"
          onClick={() => onOpen(entry.name)}
          className="max-w-xs"
        >
          <Folder className="size-4" />
          <span className="truncate">{entry.name}</span>
          <span className="text-muted-foreground">{entry.count}</span>
        </Button>
      ))}
    </div>
  );
}
