import { useState } from 'react';
import { Plus } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/common/page/EmptyState';
import NoteBoardNameDialog from './NoteBoardNameDialog';

// Shown when a project has no note boards. It offers to create the first one, so
// it is a click away instead of hidden behind the "+" in the header.
export default function NotesEmptyState({
  projectKey,
  onCreate,
}: {
  projectKey: string;
  onCreate: (name: string, personal: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const { can } = usePermissions();
  const canCreate = can('note_boards', 'create');

  return (
    <>
      <EmptyState
        title="No boards yet"
        description="A board is a freeform canvas for sticky notes."
      >
        {canCreate && (
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="size-3.5" />
            New board
          </Button>
        )}
      </EmptyState>

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
    </>
  );
}
