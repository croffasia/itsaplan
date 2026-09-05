'use client';

import { useTranslations } from 'next-intl';
import SettingsSection from '@/components/common/page/SettingsSection';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import McpConnectionGuide from './McpConnectionGuide';
import McpOAuthGuide from './McpOAuthGuide';
import { MCP_URL } from '../utils/clients';

const discoveryUrl = `${new URL(MCP_URL).origin}/.well-known/oauth-authorization-server`;

export default function McpAuthConfiguration() {
  const t = useTranslations('mcp');

  return (
    <SettingsSection title={t('oauth.configuration')}>
      <Tabs defaultValue="oauth" className="gap-5">
        <TabsList variant="line" aria-label={t('oauth.methodTabsAria')}>
          <TabsTrigger value="oauth">{t('oauth.method')}</TabsTrigger>
          <TabsTrigger value="api-key">{t('oauth.personalKey')}</TabsTrigger>
        </TabsList>
        <TabsContent value="oauth">
          <McpOAuthGuide mcpUrl={MCP_URL} discoveryUrl={discoveryUrl} />
        </TabsContent>
        <TabsContent value="api-key">
          <McpConnectionGuide />
        </TabsContent>
      </Tabs>
    </SettingsSection>
  );
}
