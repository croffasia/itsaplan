import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import NoteBoardNameDialog from './NoteBoardNameDialog';

// Shown when a project has no note boards. Names what a board is and offers to
// create the first one, so it is a click away instead of hidden behind the "+".
export default function NotesEmptyState({
  projectKey,
  onCreate,
}: {
  projectKey: string;
  onCreate: (name: string, personal: boolean) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <h2 className="text-base font-medium text-foreground">No boards yet</h2>
      <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">
        A board is a freeform canvas for sticky notes. Create one to start jotting things down.
      </p>

      <Button className="mt-6" onClick={() => setOpen(true)}>
        <Plus className="size-4" /> New board
      </Button>

      <NoteBoardNameDialog
        key={open ? 'open' : 'closed'}
        open={open}
        title="New board"
        description="A freeform canvas for sticky notes."
        projectKey={projectKey}
        initial=""
        withVisibility
        onClose={() => setOpen(false)}
        onSubmit={(name, personal) => {
          onCreate(name, personal);
          setOpen(false);
        }}
      />
    </div>
  );
}
