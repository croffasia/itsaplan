import { Check, Eye, EyeOff, LoaderCircle } from 'lucide-react';
import { useIsMutating } from '@tanstack/react-query';
import type { Assignee } from '@/lib/api/endpoints/projects';
import type { IssueWatcher } from '@/lib/api/endpoints/issues';
import { useSession } from '@/lib/auth-client';
import Avatar from '@/components/common/Avatar';
import { Pill } from '@/components/common/fields/Pill';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  useSetIssueWatcher,
  useSetIssueWatching,
  watcherMutationKey,
} from '../../services/watchers.service';
import { useTranslations } from 'next-intl';

// Who follows the issue. Everyone can subscribe themselves; members who may edit
// the issue also curate the watcher list from the same pill.
export default function IssueWatchers({
  issueId,
  watchers,
  members,
  canManage = false,
}: {
  issueId: number;
  watchers: IssueWatcher[];
  members: Assignee[];
  canManage?: boolean;
}) {
  const t = useTranslations('issue.watchers');
  const { data: session } = useSession();
  const currentUserId = session?.user.id ?? null;
  const watching = watchers.some((w) => w.userId === currentUserId);
  const setWatching = useSetIssueWatching(issueId);
  const setWatcher = useSetIssueWatcher(issueId);
  const watcherWrites = useIsMutating({ mutationKey: watcherMutationKey(issueId) });
  const writePending = watcherWrites > 0;
  const watcherIds = new Set(watchers.map((watcher) => watcher.userId));

  const toggleWatcher = (userId: string) => {
    setWatcher.mutate({ userId, watching: !watcherIds.has(userId) });
  };

  const watcherStack = watchers.length > 0 && (
    <span className="flex items-center -space-x-1.5 rtl:space-x-reverse">
      {watchers.slice(0, 4).map((watcher) => (
        <Tooltip key={watcher.userId}>
          <TooltipTrigger asChild>
            <Avatar
              name={watcher.name}
              image={watcher.image}
              className="size-5 ring-2 ring-card transition-transform hover:z-10 hover:scale-110"
            />
          </TooltipTrigger>
          <TooltipContent>
            {watcher.userId === currentUserId ? t('you', { name: watcher.name }) : watcher.name}
          </TooltipContent>
        </Tooltip>
      ))}
      {watchers.length > 4 && (
        <span className="relative z-10 flex size-5 items-center justify-center rounded-full bg-muted text-[10px] ring-2 ring-card">
          +{watchers.length - 4}
        </span>
      )}
    </span>
  );

  const watchLabel = watching ? t('unwatch') : t('watch');
  const toggleSelf = () => setWatching.mutate({ watching: !watching });

  if (!canManage) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Both the label and the icon name the action the click performs, not the
            current state: the crossed-out eye goes with Unwatch. The state is what
            the stack of watchers next to it shows. */}
        <Pill active={watching} disabled={!currentUserId || writePending} onClick={toggleSelf}>
          {watching ? <EyeOff /> : <Eye />}
          {watchLabel}
        </Pill>
        {watchers.length > 0 ? (
          <span
            className="flex h-7 items-center px-1"
            role="group"
            aria-label={t('watchingCount', { count: watchers.length })}
          >
            {watcherStack}
            <span className="sr-only">{watchers.map((watcher) => watcher.name).join(', ')}</span>
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">
            {t('watchingCount', { count: watchers.length })}
          </span>
        )}
      </div>
    );
  }

  // One pill for everything about watching: it shows who watches, and its list starts
  // with the person's own Watch or Unwatch, then the members to add or remove.
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Pill active={watching} title={t('manage')}>
          <Eye />
          {watcherStack}
          <span className="truncate">
            {watchers.length > 0 ? t('watchingCount', { count: watchers.length }) : t('watch')}
          </span>
          {writePending && <LoaderCircle className="animate-spin text-muted-foreground" />}
        </Pill>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <Command>
          <CommandInput aria-label={t('search')} placeholder={t('search')} />
          <CommandList>
            <CommandEmpty>{t('empty')}</CommandEmpty>
            {currentUserId && (
              <CommandGroup>
                <CommandItem value={watchLabel} disabled={writePending} onSelect={toggleSelf}>
                  {watching ? <EyeOff /> : <Eye />}
                  {watchLabel}
                </CommandItem>
              </CommandGroup>
            )}
            <CommandGroup heading={t('manage')}>
              {members.map((member) => {
                const selected = watcherIds.has(member.userId);
                return (
                  <CommandItem
                    key={member.userId}
                    value={`${member.name} ${member.email}`}
                    aria-label={
                      selected
                        ? t('remove', { name: `${member.name} (${member.email})` })
                        : t('add', { name: `${member.name} (${member.email})` })
                    }
                    disabled={writePending}
                    onSelect={() => toggleWatcher(member.userId)}
                  >
                    <Avatar name={member.name} image={member.image} className="size-6" />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate" dir="auto">
                        {member.name}
                      </span>
                      <span className="truncate text-xs text-muted-foreground" dir="ltr">
                        {member.email}
                      </span>
                    </span>
                    {setWatcher.isPending && setWatcher.variables?.userId === member.userId ? (
                      <LoaderCircle className="animate-spin" />
                    ) : (
                      <Check className={selected ? 'opacity-100' : 'opacity-0'} />
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
