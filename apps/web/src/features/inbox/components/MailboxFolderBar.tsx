'use client';

import { Archive, Inbox, FileText, Folder, Send, ShieldAlert, Trash2 } from 'lucide-react';
import type { MailFolder, MailFolderKind } from '@/lib/api';
import { cn } from '@/lib/utils';

const ICON: Record<MailFolderKind, typeof Inbox> = {
  inbox: Inbox,
  sent: Send,
  drafts: FileText,
  spam: ShieldAlert,
  trash: Trash2,
  archive: Archive,
  other: Folder,
};

// The folders of the connected account, in the order Zoho reports them. It scrolls
// sideways rather than wrapping, so the message list keeps its height on a phone.
export default function MailboxFolderBar({
  folders,
  current,
  loading,
  onSelect,
}: {
  folders: MailFolder[];
  current: string;
  loading: boolean;
  onSelect: (folder: MailFolder) => void;
}) {
  if (loading || folders.length === 0) return null;

  return (
    <div className="flex gap-1 overflow-x-auto border-b px-2 py-1.5">
      {folders.map((folder) => {
        const Icon = ICON[folder.kind];
        const active = folder.path === current;
        return (
          <button
            key={folder.path}
            type="button"
            onClick={() => onSelect(folder)}
            title={`${folder.name} · ${folder.total} messages`}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs',
              active ? 'bg-accent font-medium' : 'text-muted-foreground hover:bg-accent/60',
            )}
          >
            <Icon className="size-3.5" />
            {folder.name}
            {folder.unread > 0 && (
              <span className="rounded-full bg-foreground px-1.5 text-[10px] leading-4 font-medium text-background tabular-nums">
                {folder.unread}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
