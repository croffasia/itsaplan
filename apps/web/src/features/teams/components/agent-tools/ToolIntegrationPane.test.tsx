import assert from 'node:assert/strict';
import { it } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import type { IntegrationMeta } from '@/lib/api/endpoints/integrations';
import common from '../../../../../messages/en/common.json';
import teams from '../../../../../messages/en/teams.json';
import { toolIntegrations } from '../../utils/toolCatalog';
import { ToolIntegrationPane } from './ToolIntegrationPane';

const exa: IntegrationMeta = {
  key: 'exa',
  label: 'Exa',
  kind: 'tool',
  locked: true,
  credentialSchema: [{ key: 'apiKey', label: 'API key', type: 'secret', required: true }],
  tools: [{ key: 'exa_search', label: 'Exa Search', description: 'Searches the web.' }],
};

function markup(meta: IntegrationMeta) {
  const [integration] = toolIntegrations([meta]);
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={{ common, teams }} timeZone="UTC">
      <ToolIntegrationPane
        entry={{
          integration,
          tools: integration.tools,
          credentials: [],
          credentialId: null,
          ready: false,
          added: [],
          pending: [],
        }}
        selected={[]}
        onAddCredential={() => {}}
        onToggle={() => {}}
        onCredential={() => {}}
      />
    </NextIntlClientProvider>,
  );
}

it('shows the tools of an integration of another edition with the way to it, and no selection', () => {
  const html = markup(exa);
  assert.match(html, /Exa is available in Cloud and Pro/);
  assert.match(html, /utm_campaign=agent-tools/);
  assert.match(html, /Search/);
  assert.doesNotMatch(html, /role="checkbox"/);
  assert.doesNotMatch(html, /No Exa credential yet/);
});

it('asks for a credential where the integration runs here', () => {
  const html = markup({ ...exa, locked: undefined });
  assert.match(html, /No Exa credential yet/);
  assert.doesNotMatch(html, /available in Cloud and Pro/);
});
