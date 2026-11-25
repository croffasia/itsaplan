import { CircleSlash } from 'lucide-react';

// Why the issue is blocked, under its card. Renders nothing for an issue its
// blocking issues hold: the card's relations already name them.
export function IssueCardBlockedReason({ reason }: { reason: string | null }) {
  if (!reason) return null;
  return (
    <div
      className="mt-2 flex items-start gap-1.5 border-t border-border/50 pt-1.5 text-xs text-muted-foreground"
    >
      <CircleSlash className="mt-0.5 size-3.5 shrink-0" />
      <span dir="auto" className="line-clamp-3 break-words" title={reason}>
        {reason}
      </span>
    </div>
  );
}
