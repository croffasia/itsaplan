import type { NoteBoard } from '@/lib/api';
import { useSession } from '@/lib/auth-client';
import { usePermissions } from '@/hooks/usePermissions';

// What the current user may do with one board. Making a board private is limited
// to its creator (the API enforces the same rule), so a board with no recorded
// creator can never be made private.
export function useNoteBoardAccess(board: NoteBoard | null | undefined) {
  const { can } = usePermissions();
  const { data: session } = useSession();
  const canEdit = can('note_boards', 'edit');
  const isCreator = board?.createdByUserId != null && board.createdByUserId === session?.user.id;
  return { canEdit, canMakePrivate: canEdit && isCreator };
}
