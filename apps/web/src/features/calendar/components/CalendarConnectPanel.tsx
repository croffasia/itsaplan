'use client';

import { CalendarDays, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CalendarConnection } from '@/lib/api';

// What the page shows before a Google account is linked. The instance needs an
// OAuth client first (god mode), and its redirect URI has to be registered in the
// Google Cloud console, so both are stated here rather than failing at Google.
export default function CalendarConnectPanel({
  connection,
  canConnect,
  connecting,
  onConnect,
}: {
  connection: CalendarConnection;
  canConnect: boolean;
  connecting: boolean;
  onConnect: () => void;
}) {
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-xl border bg-card p-6 text-center">
        <CalendarDays className="mx-auto size-8 text-muted-foreground" />
        <h2 className="mt-3 text-base font-medium">Connect your Google Calendar</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Your calendars are read straight from Google each time this page opens. Nothing is copied
          into this dashboard: only the token that grants access is stored, encrypted.
        </p>

        {connection.instanceReady ? (
          <Button className="mt-5" onClick={onConnect} disabled={!canConnect || connecting}>
            {connecting && <Loader2 className="size-4 animate-spin" />}
            Connect Google Calendar
          </Button>
        ) : (
          <div className="mt-5 rounded-lg border border-dashed p-4 text-left">
            <p className="text-sm font-medium">This instance has no Google client yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Set a Google OAuth client under Instance settings, enable the Google Calendar API in
              the same Google Cloud project, and add this redirect URI to the client:
            </p>
            <code className="mt-2 block overflow-x-auto rounded-md bg-muted px-2 py-1.5 font-mono text-xs">
              {connection.redirectUri}
            </code>
            <Button asChild variant="outline" size="sm" className="mt-3">
              <a
                href="https://console.cloud.google.com/apis/credentials"
                target="_blank"
                rel="noreferrer"
              >
                Google Cloud console
                <ExternalLink className="size-3.5" />
              </a>
            </Button>
          </div>
        )}

        {!canConnect && connection.instanceReady && (
          <p className="mt-3 text-sm text-muted-foreground">
            Connecting an account needs edit access to Calendar.
          </p>
        )}
      </div>
    </div>
  );
}
