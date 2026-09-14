import { CircleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function SocialErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex min-h-80 flex-col items-center justify-center gap-3 text-center">
      <CircleAlert className="size-5 text-muted-foreground" />
      <div>
        <p className="text-sm font-medium">Social data is unavailable</p>
        <p className="text-sm text-muted-foreground">Check the Zernio connection and try again.</p>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}
