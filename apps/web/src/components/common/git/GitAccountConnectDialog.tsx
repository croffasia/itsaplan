import { useEffect, useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { CircleX, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type {
  GitAccount,
  GitAccountCheck,
  GitAccountProvider,
} from '@/lib/api/endpoints/gitAccounts';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import SecretInput from '@/components/common/inputs/SecretInput';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCheckGitAccount, useConnectGitAccount } from '@/services/gitAccounts.service';
import { GIT_PROVIDER_CONFIG } from '@/utils/gitProviderConfig';
import GitAccountProfile from './GitAccountProfile';
import GitHostMark from './GitHostMark';

const HOSTS: GitAccountProvider[] = ['github', 'gitlab', 'gitea', 'forgejo'];

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
          <div className="space-y-2">
            <Label htmlFor="git-account-host">{t('accountHost')}</Label>
            <Select
              value={provider}
              onValueChange={(value) =>
                edit(() => {
                  const next = value as GitAccountProvider;
                  setProvider(next);
                  setBaseUrl(GIT_PROVIDER_CONFIG[next].defaultBaseUrl);
                })
              }
            >
              <SelectTrigger id="git-account-host" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HOSTS.map((value) => (
                  <SelectItem key={value} value={value}>
                    <GitHostMark host={value} className="size-3.5" />
                    {GIT_PROVIDER_CONFIG[value].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="git-account-url">{t('nativeBaseUrl')}</Label>
            <Input
              id="git-account-url"
              type="url"
              dir="ltr"
              value={baseUrl}
              onChange={(event) => edit(() => setBaseUrl(event.target.value))}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="git-account-token">{t('nativeAccessToken')}</Label>
            <SecretInput
              id="git-account-token"
              value={token}
              onChange={(value) => edit(() => setToken(value))}
              hasStored={false}
              status={status}
            />
            <p className="text-xs text-muted-foreground">{t('accountTokenHint')}</p>
            <div role="status" className="pt-1 empty:hidden">
              {refusal && (
                <Alert variant="destructive">
                  <CircleX />
                  <AlertDescription>{refusal}</AlertDescription>
                </Alert>
              )}
            </div>
          </div>
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
