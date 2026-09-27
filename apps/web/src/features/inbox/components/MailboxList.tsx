'use client';

import { Fragment, useState } from 'react';
import { ChevronDown, Pin, Sparkles } from 'lucide-react';
import type { MailMessageSummary } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import MailboxListItem from './MailboxListItem';

function dayLabel(value: string): string {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  }).format(date);
}

export default function MailboxList({
  messages,
  selectedUid,
  pinnedUids,
  aiAssistance,
  loading,
  error,
  onSelect,
  onTogglePin,
  onAiAssistanceChange,
  onRetry,
}: {
  messages: MailMessageSummary[];
  selectedUid: number | null;
  pinnedUids: Set<string>;
  aiAssistance: boolean;
  loading: boolean;
  error: boolean;
  onSelect: (message: MailMessageSummary) => void;
  onTogglePin: (uid: number) => void;
  onAiAssistanceChange: (enabled: boolean) => void;
  onRetry: () => void;
}) {
  const [pinnedOpen, setPinnedOpen] = useState(true);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        Syncing mail…
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center text-sm text-muted-foreground">
        Could not sync email from Zoho.
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      </div>
    );
  }
  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
        No email in this inbox
      </div>
    );
  }
  const pinned = messages.filter((message) => pinnedUids.has(String(message.uid)));
  const unpinned = messages.filter((message) => !pinnedUids.has(String(message.uid)));

  return (
    <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
      <div className="-mx-2 -mt-2 mb-2 flex w-[calc(100%+1rem)] items-center gap-3 bg-muted/50 px-4 py-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
          <Sparkles className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-medium">Smart responses</span>
          <span className="block truncate text-[11px] text-muted-foreground">
            Email summaries and writing assistance
          </span>
        </span>
        <Switch
          checked={aiAssistance}
          onCheckedChange={onAiAssistanceChange}
          aria-label="Enable email summaries and AI assistance"
        />
      </div>
      {pinned.length > 0 && (
        <>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 pt-1 pb-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
            onClick={() => setPinnedOpen((open) => !open)}
            aria-expanded={pinnedOpen}
          >
            <Pin className="size-3" />
            <span>Pinned</span>
            <span className="ml-auto">{pinned.length}</span>
            <ChevronDown
              className={cn('size-3 transition-transform', !pinnedOpen && '-rotate-90')}
            />
          </button>
          {pinnedOpen &&
            pinned.map((message) => (
              <MailboxListItem
                key={message.uid}
                message={message}
                selected={selectedUid === message.uid}
                pinned
                onSelect={() => onSelect(message)}
                onTogglePin={() => onTogglePin(message.uid)}
              />
            ))}
        </>
      )}
      {unpinned.map((message, index) => {
        const day = dayLabel(message.receivedAt);
        const newDay = index === 0 || day !== dayLabel(unpinned[index - 1]!.receivedAt);
        return (
          <Fragment key={message.uid}>
            {newDay && (
              <p
                className={cn(
                  'px-3 pt-3 pb-1 text-[11px] font-medium text-muted-foreground',
                  (index > 0 || pinned.length > 0) && 'mt-2 border-t border-border/60',
                )}
              >
                {day}
              </p>
            )}
            <MailboxListItem
              message={message}
              selected={selectedUid === message.uid}
              pinned={false}
              onSelect={() => onSelect(message)}
              onTogglePin={() => onTogglePin(message.uid)}
            />
          </Fragment>
        );
      })}
    </div>
  );
}
