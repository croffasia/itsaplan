import { Plus, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function InitiativesEmpty({
  canCreate,
  onCreate,
}: {
  canCreate: boolean;
  onCreate: () => void;
}) {
  return (
    <div className="mx-4 mt-2 flex min-h-[320px] flex-col items-center justify-center gap-4 rounded-xl bg-muted/30 px-6 py-16 text-center">
      <div className="flex size-11 items-center justify-center rounded-xl bg-background text-muted-foreground shadow-sm">
        <Target className="size-5" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">No initiatives yet</p>
        <p className="mx-auto max-w-xs text-xs leading-relaxed text-muted-foreground">
          Group related issues under a larger goal to track its progress and health in one place.
        </p>
      </div>
      {canCreate && (
        <Button size="sm" className="h-8 gap-1.5" onClick={onCreate}>
          <Plus className="size-3.5" />
          New initiative
        </Button>
      )}
    </div>
  );
}
