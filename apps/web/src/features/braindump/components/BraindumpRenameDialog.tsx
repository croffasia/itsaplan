import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { BraindumpEntry } from '@/lib/api';

// The name a dump carries is what its Obsidian note is called, so it is worth
// fixing before filing — especially for a voice memo, whose title was derived
// from the transcript.
export default function BraindumpRenameDialog({
  entry,
  onOpenChange,
  onRename,
}: {
  entry: BraindumpEntry | null;
  onOpenChange: (open: boolean) => void;
  onRename: (title: string) => void;
}) {
  const [title, setTitle] = useState('');

  // Refill when a different dump is opened, not on every render.
  useEffect(() => {
    if (entry) setTitle(entry.title);
  }, [entry]);

  return (
    <Dialog open={entry != null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename this dump</DialogTitle>
          <DialogDescription>
            This is the heading on the card, and the file name it gets in your vault.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="braindump-rename">Name</Label>
          <Input
            id="braindump-rename"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={200}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && title.trim().length > 0) onRename(title.trim());
            }}
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={title.trim().length === 0}
            onClick={() => onRename(title.trim())}
          >
            Save name
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
