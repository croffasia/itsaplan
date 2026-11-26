import { useTranslations } from 'next-intl';
import type { GitConnectionProvider } from '@/lib/api/endpoints/git';
import { Label } from '@/components/ui/label';
import { gitTokenUrl } from '@/utils/gitProviderConfig';

// The token field's label, with a link to the host page that creates one once the address
// is known.
export default function GitTokenLabel({
  htmlFor,
  provider,
  baseUrl,
}: {
  htmlFor: string;
  provider: GitConnectionProvider;
  baseUrl: string;
}) {
  const t = useTranslations('settings.git');
  const createToken = gitTokenUrl(provider, baseUrl);
  return (
    <div className="flex items-baseline justify-between gap-2">
      <Label htmlFor={htmlFor}>{t('nativeAccessToken')}</Label>
      {createToken && (
        <a
          href={createToken}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-muted-foreground underline decoration-border underline-offset-3 hover:text-foreground"
        >
          {t('accountCreateToken')}
        </a>
      )}
    </div>
  );
}
