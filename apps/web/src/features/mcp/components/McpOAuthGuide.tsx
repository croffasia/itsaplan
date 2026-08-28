'use client';

import { useTranslations } from 'next-intl';
import McpCodeBlock from './McpCodeBlock';

type McpOAuthGuideProps = {
  mcpUrl: string;
  discoveryUrl: string;
};

export default function McpOAuthGuide({ mcpUrl, discoveryUrl }: McpOAuthGuideProps) {
  const t = useTranslations('mcp');

  return (
    <div className="space-y-5 rounded-lg border bg-card p-5">
      <div className="space-y-1">
        <h2 className="font-medium">{t('oauth.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('oauth.description')}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <span className="text-xs font-medium text-muted-foreground">{t('oauth.endpoint')}</span>
          <McpCodeBlock code={mcpUrl} />
        </div>
        <div className="space-y-2">
          <span className="text-xs font-medium text-muted-foreground">{t('oauth.discovery')}</span>
          <McpCodeBlock code={discoveryUrl} />
        </div>
      </div>

      <ol className="space-y-2 border-s-2 border-primary/30 ps-4 text-sm text-muted-foreground">
        <li>{t('oauth.steps.add')}</li>
        <li>{t('oauth.steps.choose')}</li>
        <li>{t('oauth.steps.signIn')}</li>
      </ol>

      <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
        {t('oauth.security')}
      </p>
    </div>
  );
}
