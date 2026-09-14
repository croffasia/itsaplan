import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function LeadsErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-8 text-center">
      <AlertCircle className="size-5 text-muted-foreground" />
      <div>
        <p className="text-sm font-medium">Leads data is unavailable</p>
        <p className="text-sm text-muted-foreground">Check the data source and try again.</p>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}
