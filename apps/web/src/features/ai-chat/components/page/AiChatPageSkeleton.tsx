import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import { AiChatThreadSkeleton } from '../shared/AiChatThreadSkeleton';

// Stands in for the AI Chat page while its agents load. The two rails keep the widths
// and borders AiChatAgentRail and AiChatThreadRail render at, so the loaded page lands
// where the skeleton was.
export function AiChatPageSkeleton() {
  return (
    <div className="flex h-full min-h-0">
      <div className="w-72 shrink-0 border-r bg-muted/30 p-2">
        <ListSkeleton rows={5} rowClassName="h-12" />
      </div>
      <div className="w-64 shrink-0 border-r bg-muted/20 p-2">
        <ListSkeleton rows={4} rowClassName="h-9" />
      </div>
      <div className="min-h-0 flex-1">
        <AiChatThreadSkeleton />
      </div>
    </div>
  );
}
