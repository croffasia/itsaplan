import assert from 'node:assert/strict';
import { it } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextIntlClientProvider } from 'next-intl';
import { JSDOM } from 'jsdom';
import invite from '../../../../messages/en/invite.json';
import ReceivedInvitesList from './ReceivedInvitesList';

it('distinguishes invitations for different projects of the same team', () => {
  const html = renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={{ invite }} timeZone="UTC">
      <ReceivedInvitesList
        items={[
          { token: 'marketing-token', teamName: 'Acme', projectName: 'Marketing' },
          { token: 'platform-token', teamName: 'Acme', projectName: 'Platform' },
        ]}
      />
    </NextIntlClientProvider>,
  );
  const dom = new JSDOM(html);
  try {
    const links = [...dom.window.document.querySelectorAll('a')];
    assert.deepEqual(
      links.map((link) => link.getAttribute('aria-label')),
      ['Review invitation: Acme / Marketing', 'Review invitation: Acme / Platform'],
    );
    assert.deepEqual(
      links.map((link) => link.getAttribute('href')),
      ['/invite/marketing-token', '/invite/platform-token'],
    );
  } finally {
    dom.window.close();
  }
});
