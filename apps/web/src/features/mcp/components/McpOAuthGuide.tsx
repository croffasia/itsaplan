'use client';

import { useTranslations } from 'next-intl';
import SettingsCard from '@/components/common/page/SettingsCard';
import McpCodeBlock from './McpCodeBlock';

type McpOAuthGuideProps = {
  mcpUrl: string;
  discoveryUrl: string;
};

export default function McpOAuthGuide({ mcpUrl, discoveryUrl }: McpOAuthGuideProps) {
  const t = useTranslations('mcp');

  return (
    <SettingsCard className="space-y-5 p-5">
      <p className="text-sm text-muted-foreground">{t('oauth.description')}</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <span className="text-xs font-medium text-muted-foreground">{t('endpoint')}</span>
          <McpCodeBlock code={mcpUrl} />
        </div>
        <div className="space-y-2">
          <span className="text-xs font-medium text-muted-foreground">{t('oauth.discovery')}</span>
          <McpCodeBlock code={discoveryUrl} />
        </div>
      </div>

      <ol className="space-y-2 border-s-2 border-primary/30 ps-4 text-sm text-muted-foreground">
        <li>{t('oauth.steps.add')}</li>
        <li>{t('oauth.steps.paste')}</li>
        <li>{t('oauth.steps.choose')}</li>
        <li>{t('oauth.steps.signIn')}</li>
      </ol>

      <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
        {t('oauth.security')}
      </p>
    </SettingsCard>
  );
}
