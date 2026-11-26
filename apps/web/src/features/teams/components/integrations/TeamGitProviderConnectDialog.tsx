import { useEffect, useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { GitConnectionProvider } from '@/lib/api/endpoints/git';
import GitHostPicker from '@/components/common/git/GitHostPicker';
import GitTokenLabel from '@/components/common/git/GitTokenLabel';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useConnectGitProvider } from '@/services/gitConnections.service';
import { GIT_CONNECTION_PROVIDERS, GIT_PROVIDER_CONFIG } from '@/utils/gitProviderConfig';

export default function TeamGitProviderConnectDialog({
  teamId,
  open,
  onOpenChange,
}: {
  teamId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('settings.git');
  const connect = useConnectGitProvider(teamId);
  const [provider, setProvider] = useState<GitConnectionProvider>('github');
  const [baseUrl, setBaseUrl] = useState(GIT_PROVIDER_CONFIG.github.defaultBaseUrl);
  const [token, setToken] = useState('');

  useEffect(() => {
    if (!open) return;
    setProvider('github');
    setBaseUrl(GIT_PROVIDER_CONFIG.github.defaultBaseUrl);
    setToken('');
  }, [open]);

  function pick(next: GitConnectionProvider) {
    setProvider(next);
    setBaseUrl(GIT_PROVIDER_CONFIG[next].defaultBaseUrl);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await connect.mutateAsync({ provider, baseUrl, token });
      toast.success(t('nativeConnected', { provider: GIT_PROVIDER_CONFIG[provider].label }));
      onOpenChange(false);
    } catch {
      // The failure already surfaced through the global mutation error toast.
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={(event) => void submit(event)} className="space-y-5">
          <DialogHeader>
            <DialogTitle>{t('nativeConnectHostTitle')}</DialogTitle>
            <DialogDescription>{t('nativeConnectHostHint')}</DialogDescription>
          </DialogHeader>
          <GitHostPicker
            id="git-provider-host"
            hosts={GIT_CONNECTION_PROVIDERS}
            value={provider}
            onChange={pick}
          />
          {/* The API accepts Bitbucket Cloud only, so its address is fixed. */}
          {provider !== 'bitbucket' && (
            <div className="space-y-2">
              <Label htmlFor="git-provider-url">{t('accountAddress')}</Label>
              <Input
                id="git-provider-url"
                type="url"
                dir="ltr"
                value={baseUrl}
                placeholder={GIT_PROVIDER_CONFIG[provider].placeholder}
                onChange={(event) => setBaseUrl(event.target.value)}
                required
              />
            </div>
          )}
          <div className="space-y-2">
            <GitTokenLabel htmlFor="git-provider-token" provider={provider} baseUrl={baseUrl} />
            <Input
              id="git-provider-token"
              type="password"
              autoComplete="off"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              {t(`nativeTokenHint.${provider}`)} {t('nativeTokenStored')}
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t('nativeCancel')}
            </Button>
            <Button type="submit" disabled={connect.isPending || !token.trim()}>
              {connect.isPending ? t('nativeConnecting') : t('nativeConnect')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
