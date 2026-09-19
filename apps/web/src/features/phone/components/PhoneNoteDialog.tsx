'use client';

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
import { Textarea } from '@/components/ui/textarea';

export default function PhoneNoteDialog({
  open,
  onOpenChange,
  caller,
  saving,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caller: string;
  saving: boolean;
  onSubmit: (content: string) => void;
}) {
  const [content, setContent] = useState('');

  useEffect(() => {
    if (open) setContent('');
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Note on the call with {caller}</DialogTitle>
          <DialogDescription>
            The note is stored at Rinkel, so it is there in their app as well.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          rows={5}
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Asked for a quote, calling back on Thursday."
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => onSubmit(content.trim())} disabled={saving || !content.trim()}>
            {saving ? 'Saving…' : 'Save note'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
