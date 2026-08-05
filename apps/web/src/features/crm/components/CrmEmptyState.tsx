import { ContactRound, Plus } from 'lucide-react';
import { EmptyState } from '@/components/common/page/EmptyState';
import { Button } from '@/components/ui/button';

export default function CrmEmptyState({
  canCreate,
  onCreate,
}: {
  canCreate: boolean;
  onCreate: () => void;
}) {
  return (
    <EmptyState
      title="No customers yet"
      description="Add your first customer to keep contacts, work, and follow-ups together."
    >
      <ContactRound className="mb-1 size-8 text-muted-foreground" />
      {canCreate && (
        <Button size="sm" onClick={onCreate}>
          <Plus />
          Add customer
        </Button>
      )}
    </EmptyState>
  );
}
