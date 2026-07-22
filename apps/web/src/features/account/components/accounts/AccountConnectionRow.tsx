'use client';

import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

// One external account: the service on the left with what it is connected to, and
// the connect or disconnect action on the right.
export default function AccountConnectionRow({
  icon,
  name,
  description,
  connectedTo,
  busy,
  disconnectHint,
  onConnect,
  onDisconnect,
}: {
  icon: ReactNode;
  name: string;
  description: string;
  // What the account is connected to (an address, a Telegram name), or null when it
  // is not connected.
  connectedTo: string | null;
  busy: boolean;
  // Why disconnecting is unavailable, when it is. Shown instead of the button.
  disconnectHint?: string;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  function action() {
    if (!connectedTo) {
      return (
        <Button size="sm" disabled={busy} onClick={onConnect}>
          Connect
        </Button>
      );
    }
    if (disconnectHint) {
      return <span className="shrink-0 text-xs text-muted-foreground">{disconnectHint}</span>;
    }
    return (
      <Button variant="outline" size="sm" disabled={busy} onClick={onDisconnect}>
        Disconnect
      </Button>
    );
  }

  return (
    <div className="flex items-center justify-between gap-6 py-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-muted/40">
          {icon}
        </span>
        <div className="min-w-0">
          <div className="text-sm font-medium">{name}</div>
          <p className="truncate text-xs text-muted-foreground">{connectedTo ?? description}</p>
        </div>
      </div>

      {action()}
    </div>
  );
}
