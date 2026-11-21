'use client';

import AccessList from '@/components/common/access/AccessList';
import { ACCESS_ICON } from '@/components/common/access/accessVisibility';
import { useNoteBoardAccessLabels } from '../hooks/useNoteBoardAccessLabels';

// Who can see a restricted board, for someone who may not change it. The picker
// (NoteBoardAccessPicker) takes this place for the board creator.
export default function NoteBoardAccessList({
  ownerUserId,
  memberIds,
}: {
  ownerUserId: string | null;
  memberIds: string[];
}) {
  const labels = useNoteBoardAccessLabels();
  const Icon = ACCESS_ICON.restricted;

  return (
    <AccessList
      trigger={
        <button
          type="button"
          aria-label={labels.access}
          className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Icon className="size-3.5" />
        </button>
      }
      ownerUserId={ownerUserId}
      memberIds={memberIds}
      labels={labels}
    />
  );
}
