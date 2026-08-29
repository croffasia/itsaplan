import { useEffect, useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { GitConnectionProvider } from '@/lib/api';
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
import { useConnectGitProvider } from '../../services/settings.service';

export default function GitProviderConnectDialog({
  projectKey,
  provider,
  open,
  onOpenChange,
}: {
  projectKey: string;
  provider: GitConnectionProvider;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('settings.git');
  const connect = useConnectGitProvider(projectKey);
  const [baseUrl, setBaseUrl] = useState(
    provider === 'github' ? 'https://github.com' : 'https://gitlab.com',
  );
  const [token, setToken] = useState('');

  useEffect(() => {
    setBaseUrl(provider === 'github' ? 'https://github.com' : 'https://gitlab.com');
    setToken('');
  }, [provider, open]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      await connect.mutateAsync({ provider, baseUrl, token });
      toast.success(
        t('nativeConnected', { provider: provider === 'github' ? 'GitHub' : 'GitLab' }),
      );
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('nativeConnectFailed'));
    }
  }

  const label = provider === 'github' ? 'GitHub' : 'GitLab';
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={(event) => void submit(event)} className="space-y-5">
          <DialogHeader>
            <DialogTitle>{t('nativeConnectTitle', { provider: label })}</DialogTitle>
            <DialogDescription>
              {provider === 'github' ? t('nativeTokenHint.github') : t('nativeTokenHint.gitlab')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`git-${provider}-url`}>{t('nativeBaseUrl')}</Label>
            <Input
              id={`git-${provider}-url`}
              type="url"
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`git-${provider}-token`}>{t('nativeAccessToken')}</Label>
            <Input
              id={`git-${provider}-token`}
              type="password"
              autoComplete="off"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">{t('nativeTokenStored')}</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
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
