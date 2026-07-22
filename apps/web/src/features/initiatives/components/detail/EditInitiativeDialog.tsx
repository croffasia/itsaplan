'use client';

import { useState } from 'react';
import type { Initiative } from '@/lib/api';
import { useUpdateInitiative } from '@/services/initiatives.service';
import Modal from '@/components/common/overlay/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

// Only title and description; the other fields are edited inline from the header pills.
export default function EditInitiativeDialog({
  initiative,
  projectKey,
  onClose,
}: {
  initiative: Initiative;
  projectKey: string;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(initiative.title);
  const [description, setDescription] = useState(initiative.description);
  const update = useUpdateInitiative(projectKey);

  const submit = async () => {
    const name = title.trim();
    if (!name) return;
    await update.mutateAsync({
      id: initiative.id,
      patch: { title: name, description: description.trim() },
    });
    onClose();
  };

  return (
    <Modal title="Edit initiative" projectKey={projectKey} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="edit-initiative-title">Title</Label>
          <Input
            id="edit-initiative-title"
            value={title}
            autoFocus
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && title.trim() && void submit()}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="edit-initiative-description">Description</Label>
          <Textarea
            id="edit-initiative-description"
            value={description}
            placeholder="What is this initiative about?"
            className="min-h-32"
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!title.trim() || update.isPending} onClick={() => void submit()}>
            {update.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
