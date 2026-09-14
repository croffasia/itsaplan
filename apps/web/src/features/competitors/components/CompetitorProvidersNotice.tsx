import Link from 'next/link';
import { Info } from 'lucide-react';
import { integrationsPath } from '@/utils/paths';
import type { CompetitorOverview } from '@/lib/api';
import { PLATFORM_META } from '../utils/competitors';

// A platform can only be read when the project has the credential behind it.
// Saying which are missing, and where to add them, beats an account that silently
// never updates.
export default function CompetitorProvidersNotice({
  providers,
  projectKey,
}: {
  providers: CompetitorOverview['providers'];
  projectKey: string;
}) {
  const missing = providers.filter((provider) => !provider.available);
  if (missing.length === 0) return null;

  const names = missing
    .map((provider) => PLATFORM_META[provider.platform as keyof typeof PLATFORM_META]?.label)
    .filter(Boolean)
    .join(', ');

  return (
    <div className="flex items-start gap-3 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
      <Info className="mt-0.5 size-4 shrink-0" />
      <p>
        <span className="font-medium text-foreground">{names}</span>{' '}
        {missing.length === 1 ? 'cannot be read yet' : 'cannot be read yet'}. Instagram needs an
        Instagram credential; TikTok and Facebook need a Firecrawl or Jina key. You can still add
        those accounts — they start reporting as soon as the credential exists. Add one under{' '}
        <Link href={integrationsPath(projectKey)} className="font-medium text-foreground underline">
          Integrations
        </Link>
        .
      </p>
    </div>
  );
}
