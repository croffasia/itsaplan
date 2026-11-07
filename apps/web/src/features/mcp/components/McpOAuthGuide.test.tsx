import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { it } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import { APP_NAME } from '@/utils/app';
import McpOAuthGuide from './McpOAuthGuide';

const messagesDir = new URL('../../../../messages/', import.meta.url);
const locales = readdirSync(messagesDir);

function markup(locale: string) {
  const mcp = JSON.parse(readFileSync(new URL(`${locale}/mcp.json`, messagesDir), 'utf8'));
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={{ mcp }} timeZone="UTC">
      <McpOAuthGuide
        mcpUrl="https://plan.example.com/mcp"
        discoveryUrl="https://plan.example.com/.well-known/oauth-authorization-server"
      />
    </NextIntlClientProvider>,
  );
}

it('names the app in the OAuth guide in every language', () => {
  const appName = renderToStaticMarkup(<>{APP_NAME}</>);
  assert.ok(locales.length > 1);
  for (const locale of locales) {
    const html = markup(locale);
    assert.equal(html.split(appName).length - 1, 3, locale);
    assert.doesNotMatch(html, /Itsaplan/, locale);
  }
});
