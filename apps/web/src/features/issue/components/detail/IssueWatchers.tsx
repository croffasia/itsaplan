import { Eye, EyeOff } from 'lucide-react';
import { type IssueWatcher } from '@/lib/api';
import { useSession } from '@/lib/auth-client';
import Avatar from '@/components/common/Avatar';
import { Pill } from '@/components/common/fields/Pill';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSetIssueWatching } from '../../services/watchers.service';
import { useTranslations } from 'next-intl';

// Who follows the issue, and the button the signed-in member subscribes and
// unsubscribes themselves with. Members subscribe only themselves, so the stack is
// a display, not a picker — the signed-in member is in it too, marked in their
// tooltip.
export default function IssueWatchers({
  issueId,
  watchers,
}: {
  issueId: number;
  watchers: IssueWatcher[];
}) {
  const t = useTranslations('issue.watchers');
  const { data: session } = useSession();
  const currentUserId = session?.user.id ?? null;
  const watching = watchers.some((w) => w.userId === currentUserId);
  const setWatching = useSetIssueWatching();

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {/* Both the label and the icon name the action the click performs, not the
          current state: the crossed-out eye goes with Unwatch. The state is what
          the stack of watchers next to it shows. */}
      <Pill
        active={watching}
        disabled={setWatching.isPending}
        onClick={() => setWatching.mutate({ issueId, watching: !watching })}
      >
        {watching ? <EyeOff /> : <Eye />}
        {watching ? t('unwatch') : t('watch')}
      </Pill>
      {/* Negative spacing so the avatars overlap; the ring in the card color keeps
          them separated. */}
      <div className="flex items-center -space-x-1.5">
        {watchers.map((watcher) => (
          <Tooltip key={watcher.userId}>
            <TooltipTrigger asChild>
              <Avatar
                name={watcher.name}
                image={watcher.image}
                className="ring-2 ring-card transition-transform hover:z-10 hover:scale-110"
              />
            </TooltipTrigger>
            <TooltipContent>
              {watcher.userId === currentUserId ? `${watcher.name} (you)` : watcher.name}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </div>
  );
}
