import { useEffect, useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type {
  GitAccount,
  GitAccountCheck,
  GitAccountProvider,
} from '@/lib/api/endpoints/gitAccounts';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useCheckGitAccount, useConnectGitAccount } from '@/services/gitAccounts.service';
import { GIT_PROVIDER_CONFIG } from '@/utils/gitProviderConfig';
import GitAccountFields from './GitAccountFields';
import GitAccountProfile from './GitAccountProfile';

// Connects the user's own account on a repository host. The token is checked first, the
// way an integration's credential is, and the dialog then shows the account it signs in
// as; only then can it be saved. Opened from the account page, and from the
// places a comment would go out under it.
export default function GitAccountConnectDialog({
  open,
  onOpenChange,
  host,
  onConnected,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // The host to start from, such as the one of a synced repository.
  host?: { provider: GitAccountProvider; baseUrl: string };
  onConnected?: (account: GitAccount) => void;
}) {
  const t = useTranslations('settings.git');
  const check = useCheckGitAccount();
  const connect = useConnectGitAccount();
  const [provider, setProvider] = useState<GitAccountProvider>('github');
  const [baseUrl, setBaseUrl] = useState('');
  const [token, setToken] = useState('');
  const [checked, setChecked] = useState<GitAccountCheck | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const start = host?.provider ?? 'github';
    setProvider(start);
    setBaseUrl(host?.baseUrl ?? GIT_PROVIDER_CONFIG[start].defaultBaseUrl);
    setToken('');
    setChecked(null);
    setRefusal(null);
  }, [open, host?.provider, host?.baseUrl]);

  // A change to any field makes an earlier answer say nothing about the new values.
  function edit(apply: () => void) {
    apply();
    setChecked(null);
    setRefusal(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = { provider, baseUrl, token };
    if (!checked) {
      try {
        setChecked(await check.mutateAsync(input));
      } catch (error) {
        setRefusal(error instanceof Error ? error.message : t('accountCheckFailed'));
      }
      return;
    }
    try {
      const account = await connect.mutateAsync(input);
      toast.success(t('accountConnected', { provider: GIT_PROVIDER_CONFIG[provider].label }));
      onConnected?.(account);
      onOpenChange(false);
    } catch {
      // The mutation cache has shown the error.
    }
  }

  const busy = check.isPending || connect.isPending;
  let status: 'valid' | 'invalid' | undefined;
  if (checked) status = 'valid';
  else if (refusal) status = 'invalid';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={(event) => void submit(event)} className="space-y-5">
          <DialogHeader>
            <DialogTitle>{t('accountConnectTitle')}</DialogTitle>
            <DialogDescription>{t('accountConnectHint')}</DialogDescription>
          </DialogHeader>
          <GitAccountFields
            provider={provider}
            baseUrl={baseUrl}
            token={token}
            status={status}
            refusal={refusal}
            onProviderChange={(next) =>
              edit(() => {
                setProvider(next);
                setBaseUrl(GIT_PROVIDER_CONFIG[next].defaultBaseUrl);
              })
            }
            onBaseUrlChange={(value) => edit(() => setBaseUrl(value))}
            onTokenChange={(value) => edit(() => setToken(value))}
          />
          <div
            role="status"
            aria-label={
              checked ? t('accountSignsInAs', { login: checked.accountLogin }) : undefined
            }
            className="empty:hidden"
          >
            {checked && <GitAccountProfile account={checked} />}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {t('nativeCancel')}
            </Button>
            <Button type="submit" disabled={busy || !token.trim() || !baseUrl.trim()}>
              {busy && <Loader2 className="animate-spin" />}
              {checked ? t('accountConnectThis') : t('accountCheck')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
