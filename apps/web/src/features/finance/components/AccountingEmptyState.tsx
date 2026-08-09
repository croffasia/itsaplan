import { BookOpenText, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AccountingEmptyState({
  canCreate,
  onCreate,
}: {
  canCreate: boolean;
  onCreate: () => void;
}) {
  return (
    <div className="flex min-h-52 flex-col items-center justify-center rounded-lg border border-dashed px-6 text-center">
      <div className="mb-4 flex size-10 items-center justify-center rounded-lg border bg-card">
        <BookOpenText className="size-5 text-muted-foreground" />
      </div>
      <h3 className="text-sm font-medium">No bookkeeping entries yet</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Add your first sale or purchase to calculate results, VAT, and outstanding amounts.
      </p>
      {canCreate && (
        <Button size="sm" className="mt-4" onClick={onCreate}>
          <Plus />
          Add entry
        </Button>
      )}
    </div>
  );
}
