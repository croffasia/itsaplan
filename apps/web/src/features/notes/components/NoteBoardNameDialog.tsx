import { useState } from 'react';
import Modal from '@/components/common/overlay/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { VISIBILITY_HINT, VISIBILITY_ICON, type NewBoardVisibility } from '../utils/visibility';

// A name prompt used for creating and renaming a note board. When `withVisibility`
// is set (creating), it also picks whether the board is public or private.
export default function NoteBoardNameDialog({
  open,
  title,
  description,
  projectKey,
  initial,
  withVisibility = false,
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  description?: string;
  projectKey?: string;
  initial: string;
  withVisibility?: boolean;
  onClose: () => void;
  onSubmit: (name: string, visibility: NewBoardVisibility) => void;
}) {
  const [name, setName] = useState(initial);
  const [visibility, setVisibility] = useState<NewBoardVisibility>('public');

  if (!open) return null;

  const isValid = name.trim().length > 0;
  const VisibilityIcon = VISIBILITY_ICON[visibility];

  return (
    <Modal title={title} description={description} projectKey={projectKey} onClose={onClose}>
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (isValid) onSubmit(name.trim(), visibility);
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="board-name">Name</Label>
          <div className="flex gap-2">
            {withVisibility && (
              <button
                type="button"
                aria-label={visibility === 'private' ? 'Make public' : 'Make private'}
                title={VISIBILITY_HINT[visibility]}
                onClick={() => setVisibility((v) => (v === 'private' ? 'public' : 'private'))}
                className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <VisibilityIcon className="size-4" />
              </button>
            )}
            <Input
              id="board-name"
              autoFocus
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Board name"
              className="h-9"
            />
          </div>
        </div>

        {withVisibility && (
          <p className="text-sm text-muted-foreground">
            {visibility === 'private'
              ? 'Only you can see this board. You can share it with picked members later.'
              : 'Everyone in the project can see this board.'}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!isValid}>
            {withVisibility ? 'Create board' : 'Save'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
