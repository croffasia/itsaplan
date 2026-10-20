'use client';

import { useTranslations } from 'next-intl';
import { Plug, Unplug } from 'lucide-react';
import { formatDate } from '@/utils/dates';
import { Button } from '@/components/ui/button';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item';
import { Skeleton } from '@/components/ui/skeleton';
import type { ConnectedApp } from '@/lib/api/endpoints/connectedApps';

export default function AccountSecurityConnectedApps({
  apps,
  isPending,
  onDisconnect,
}: {
  apps: ConnectedApp[];
  isPending: boolean;
  onDisconnect: (app: ConnectedApp) => void;
}) {
  const t = useTranslations('account.security');
  if (isPending) {
    return (
      <div className="space-y-2 py-3">
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (apps.length === 0) {
    return <p className="py-6 text-sm text-muted-foreground">{t('connectedAppsEmpty')}</p>;
  }

  return (
    <ItemGroup>
      {apps.map((app) => (
        <Item
          key={app.clientId}
          size="sm"
          className="rounded-none border-0 border-b border-border px-1 last:border-b-0 hover:bg-accent/50"
        >
          <ItemMedia>
            <Plug className="size-4" />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>{app.name}</ItemTitle>
            <ItemDescription>
              {app.lastUsedAt
                ? t('connectedAppUsed', {
                    connected: formatDate(app.connectedAt),
                    used: formatDate(app.lastUsedAt),
                  })
                : t('connectedAppSince', { connected: formatDate(app.connectedAt) })}
            </ItemDescription>
          </ItemContent>
          <ItemActions>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-destructive"
              title={t('disconnectApp')}
              onClick={() => onDisconnect(app)}
            >
              <Unplug className="size-4" />
            </Button>
          </ItemActions>
        </Item>
      ))}
    </ItemGroup>
  );
}
