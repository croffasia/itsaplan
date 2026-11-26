import { useTranslations } from 'next-intl';
import { CircleX } from 'lucide-react';
import type { GitAccountProvider } from '@/lib/api/endpoints/gitAccounts';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import { GIT_PROVIDER_CONFIG } from '@/utils/gitProviderConfig';
import GitHostMark from './GitHostMark';

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
      <div className="space-y-2">
        <Label htmlFor="git-account-host">{t('accountHost')}</Label>
        <Select
          value={provider}
          onValueChange={(value) => onProviderChange(value as GitAccountProvider)}
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
          onChange={(event) => onBaseUrlChange(event.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="git-account-token">{t('nativeAccessToken')}</Label>
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
