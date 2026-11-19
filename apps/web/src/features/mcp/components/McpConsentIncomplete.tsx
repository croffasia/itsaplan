import { Link2Off } from 'lucide-react';
import { useTranslations } from 'next-intl';
import McpConsentTile from './McpConsentTile';

// The page was opened without the signed request, so there is nothing to answer.
export default function McpConsentIncomplete() {
  const t = useTranslations('mcp.oauth.consent');
  return (
    <div className="flex flex-col items-center gap-4 py-6 text-center">
      <McpConsentTile>
        <Link2Off className="size-5 text-muted-foreground" />
      </McpConsentTile>
      <h1 className="text-2xl font-bold">{t('incompleteTitle')}</h1>
      <p className="text-sm text-muted-foreground">{t('incompleteBody')}</p>
    </div>
  );
}
