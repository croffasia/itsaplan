'use client';

import { useState } from 'react';
import { ChevronRight, TriangleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { GitProviderConnection } from '@/lib/api/endpoints/git';
import GitHostMark from '@/components/common/git/GitHostMark';
import GitRepositories from '@/components/common/git/GitRepositories';
import ConfirmDialog from '@/components/common/overlay/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { useDisconnectGitProvider } from '@/services/gitConnections.service';
import { GIT_PROVIDER_CONFIG } from '@/utils/gitProviderConfig';

// A team's account on a repository host, with the repositories whose webhook failed. It
// opens on the repositories it syncs with the team's projects.
export default function TeamGitConnectionRow({
  teamId,
  connection,
}: {
  teamId: number;
  connection: GitProviderConnection;
}) {
  const t = useTranslations('settings.git');
  const disconnect = useDisconnectGitProvider(teamId);
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const { label, defaultBaseUrl } = GIT_PROVIDER_CONFIG[connection.provider];
  const host = connection.baseUrl === defaultBaseUrl ? null : new URL(connection.baseUrl).host;

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="grid grid-cols-[1rem_auto_5.5rem_minmax(0,1fr)_auto] items-center gap-x-3 text-sm"
    >
      <CollapsibleTrigger className="group/fold col-span-4 grid min-h-13 grid-cols-subgrid items-center rounded-sm text-start outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
        <ChevronRight
          className={cn(
            'size-4 text-muted-foreground transition group-hover/fold:text-foreground',
            open ? 'rotate-90' : 'rtl:rotate-180',
          )}
        />
        <GitHostMark host={connection.provider} className="size-4.5" />
        <span className="font-medium">{label}</span>
        <span dir="ltr" className="wrap-anywhere text-muted-foreground">
          {host ? `${connection.accountLogin} · ${host}` : connection.accountLogin}
        </span>
      </CollapsibleTrigger>
      <Button
        variant="ghost"
        size="sm"
        className="-me-3 text-destructive hover:bg-destructive/10 hover:text-destructive"
        aria-label={t('nativeDisconnectProvider', { provider: label })}
        onClick={() => setConfirming(true)}
      >
        {t('nativeDisconnect')}
      </Button>
      {connection.repositories
        .filter((repository) => repository.lastError)
        .map((repository) => (
          <p
            key={repository.id}
            className="col-span-2 col-start-4 -mt-2 mb-3 flex items-start gap-2 text-xs text-destructive"
          >
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
            <span>
              <span dir="ltr" className="font-medium">
                {repository.fullName}
              </span>
              : {repository.lastError}
            </span>
          </p>
        ))}
      <CollapsibleContent className="col-span-3 col-start-3 pb-4">
        <GitRepositories source={{ teamId, connectionId: connection.id }} />
      </CollapsibleContent>
      {confirming && (
        <ConfirmDialog
          title={t('nativeDisconnectTitle', { provider: label })}
          confirmLabel={t('nativeDisconnect')}
          onClose={() => setConfirming(false)}
          onConfirm={async () => {
            await disconnect.mutateAsync(connection.id);
            toast.success(t('nativeDisconnected', { provider: label }));
            setConfirming(false);
          }}
        >
          <p className="text-sm text-muted-foreground">{t('nativeDisconnectWarning')}</p>
        </ConfirmDialog>
      )}
    </Collapsible>
  );
}
