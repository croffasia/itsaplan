'use client';

import { useState } from 'react';
import { AlertTriangle, ClipboardPaste, Loader2, RotateCw, ShieldCheck } from 'lucide-react';
import '@xterm/xterm/css/xterm.css';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ManagedServer } from '@/lib/api';
import { useServerTerminal } from '../hooks/useServerTerminal';

const STATUS_LABEL = {
  connecting: 'connecting',
  connected: 'connected',
  closed: 'session ended',
  error: 'failed',
} as const;

export default function ServerTerminal({ server }: { server: ManagedServer }) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const { status, error, pinned, paste, reconnect } = useServerTerminal(server.id, container);
  const ended = status === 'closed' || status === 'error';

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              'size-1.5 shrink-0 rounded-full',
              status === 'connected' && 'bg-foreground',
              status === 'connecting' && 'bg-muted-foreground/50',
              (status === 'closed' || status === 'error') && 'bg-destructive',
            )}
          />
          <span className="truncate font-mono text-xs">
            {server.username}@{server.host}:{server.port}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="text-xs text-muted-foreground">
            {status === 'connecting' && <Loader2 className="mr-1 inline size-3 animate-spin" />}
            {STATUS_LABEL[status]}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6"
            title="Paste the clipboard into the shell (Ctrl+Shift+V, or right-click)"
            aria-label="Paste into the terminal"
            disabled={status !== 'connected'}
            onClick={() => void paste()}
          >
            <ClipboardPaste className="size-3.5" />
          </Button>
          {ended && (
            <Button type="button" variant="outline" size="sm" className="h-6" onClick={reconnect}>
              <RotateCw className="size-3.5" />
              Reconnect
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 border-b bg-destructive/5 px-4 py-2.5 text-xs">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
          <span>{error}</span>
        </div>
      )}

      {pinned && (
        <div className="flex items-start gap-2 border-b px-4 py-2.5 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0" />
          <span>
            Host key pinned: <span className="font-mono text-foreground">{pinned}</span>. Compare it
            with what the provider published; a later change is refused.
          </span>
        </div>
      )}

      <div
        ref={setContainer}
        className="min-h-0 flex-1 overflow-hidden bg-card p-2"
        // xterm renders its own focusable layer; the wrapper only sizes it.
        role="presentation"
      />
    </div>
  );
}
