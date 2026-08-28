'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import McpConnectionGuide from './McpConnectionGuide';
import McpOAuthGuide from './McpOAuthGuide';
import { MCP_URL } from '../utils/clients';

const discoveryUrl = `${new URL(MCP_URL).origin}/.well-known/oauth-authorization-server`;

type AuthMode = 'oauth' | 'api-key';

export default function McpAuthConfiguration() {
  const t = useTranslations('mcp');
  const [mode, setMode] = useState<AuthMode>('oauth');

  return (
    <section className="space-y-5">
      <div className="border-b pb-1">
        <span className="text-xs font-medium text-muted-foreground">
          {t('oauth.configuration')}
        </span>
      </div>

      <div
        role="tablist"
        aria-label={t('oauth.methodTabsAria')}
        className="flex w-fit rounded-lg border bg-muted/30 p-1"
      >
        <button
          role="tab"
          aria-selected={mode === 'oauth'}
          onClick={() => setMode('oauth')}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
            mode === 'oauth'
              ? 'bg-background font-medium text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {t('oauth.method')}
        </button>
        <button
          role="tab"
          aria-selected={mode === 'api-key'}
          onClick={() => setMode('api-key')}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
            mode === 'api-key'
              ? 'bg-background font-medium text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {t('oauth.personalKey')}
        </button>
      </div>

      {mode === 'oauth' ? (
        <McpOAuthGuide mcpUrl={MCP_URL} discoveryUrl={discoveryUrl} />
      ) : (
        <McpConnectionGuide />
      )}
    </section>
  );
}
