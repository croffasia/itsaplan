import { BadgeEuro, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function FinanceEmptyState({
  canCreate,
  onCreate,
}: {
  canCreate: boolean;
  onCreate: () => void;
}) {
  return (
    <div className="flex min-h-52 flex-col items-center justify-center rounded-lg border border-dashed px-6 text-center">
      <div className="mb-4 flex size-10 items-center justify-center rounded-lg border bg-card">
        <BadgeEuro className="size-5 text-muted-foreground" />
      </div>
      <h3 className="text-sm font-medium">No transactions yet</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Add your first income or expense to start tracking project finances.
      </p>
      {canCreate && (
        <Button size="sm" className="mt-4" onClick={onCreate}>
          <Plus />
          Add transaction
        </Button>
      )}
    </div>
  );
}
