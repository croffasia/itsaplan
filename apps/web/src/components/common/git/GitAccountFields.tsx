import { useTranslations } from 'next-intl';
import { CircleX } from 'lucide-react';
import type { GitAccountProvider } from '@/lib/api/endpoints/gitAccounts';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import SecretInput from '@/components/common/inputs/SecretInput';
import { GIT_PROVIDER_CONFIG } from '@/utils/gitProviderConfig';
import GitHostPicker from './GitHostPicker';
import GitTokenLabel from './GitTokenLabel';

const HOSTS: GitAccountProvider[] = ['github', 'gitlab', 'gitea', 'forgejo'];

// The host, its address and the token of an account to connect, with the host's refusal
// of the token when it gave one.
export default function GitAccountFields({
  provider,
  baseUrl,
  token,
  status,
  refusal,
  onProviderChange,
  onBaseUrlChange,
  onTokenChange,
}: {
  provider: GitAccountProvider;
  baseUrl: string;
  token: string;
  status: 'valid' | 'invalid' | undefined;
  refusal: string | null;
  onProviderChange: (provider: GitAccountProvider) => void;
  onBaseUrlChange: (baseUrl: string) => void;
  onTokenChange: (token: string) => void;
}) {
  const t = useTranslations('settings.git');
  return (
    <>
      <GitHostPicker
        id="git-account-host"
        hosts={HOSTS}
        value={provider}
        onChange={onProviderChange}
      />
      <div className="space-y-2">
        <Label htmlFor="git-account-url">{t('accountAddress')}</Label>
        <Input
          id="git-account-url"
          type="url"
          dir="ltr"
          value={baseUrl}
          placeholder={GIT_PROVIDER_CONFIG[provider].placeholder}
          onChange={(event) => onBaseUrlChange(event.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <GitTokenLabel htmlFor="git-account-token" provider={provider} baseUrl={baseUrl} />
        <SecretInput
          id="git-account-token"
          value={token}
          onChange={onTokenChange}
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
    </>
  );
}
