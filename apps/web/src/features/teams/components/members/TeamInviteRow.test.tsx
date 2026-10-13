import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { NextIntlClientProvider } from 'next-intl';
import { JSDOM } from 'jsdom';
import type { InviteRow } from '@/lib/api/endpoints/invites';
import teams from '../../../../../messages/en/teams.json';
import common from '../../../../../messages/en/common.json';

// A team's expired invite says so in place of "Invited" and offers a renewal instead of
// its dead link; a valid one is mailed again or its link copied.
const replacedGlobals = [
  'window',
  'document',
  'navigator',
  'Node',
  'Element',
  'HTMLElement',
  'HTMLButtonElement',
  'Event',
  'MouseEvent',
  'IS_REACT_ACT_ENVIRONMENT',
] as const;

let dom: JSDOM;
let root: Root;
let originals: Map<string, PropertyDescriptor | undefined>;
let renewed: number[] = [];

const DAY = 24 * 60 * 60 * 1000;
const invite = (expiresInDays: number): InviteRow => ({
  id: 9,
  token: 'tok',
  email: 'crew@example.test',
  teamRole: 'member',
  projectKey: null,
  projectName: null,
  role: null,
  roleId: null,
  roleName: null,
  status: 'pending',
  createdAt: new Date(Date.now() - 8 * DAY).toISOString(),
  expiresAt: new Date(Date.now() + expiresInDays * DAY).toISOString(),
  respondedAt: null,
  invitedByName: null,
  invitedByEmail: null,
});

async function render(row: InviteRow, { mayRenew = true } = {}) {
  const { default: TeamInviteRow } = await import('./TeamInviteRow');
  await act(async () =>
    root.render(
      <NextIntlClientProvider locale="en" messages={{ teams, common }} timeZone="UTC">
        <TeamInviteRow
          invite={row}
          onRevoke={() => {}}
          onRenew={mayRenew ? (i) => renewed.push(i.id) : undefined}
          renewing={false}
        />
      </NextIntlClientProvider>,
    ),
  );
}

const button = (text: string) =>
  [...document.querySelectorAll('button')].find((b) => b.textContent?.includes(text));

beforeEach(async () => {
  originals = new Map(
    replacedGlobals.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'https://example.test/' });
  for (const name of replacedGlobals) {
    if (name in dom.window) {
      Object.defineProperty(globalThis, name, {
        configurable: true,
        value: dom.window[name as keyof typeof dom.window],
      });
    }
  }
  Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', {
    configurable: true,
    value: true,
  });
  renewed = [];
  const { createRoot } = await import('react-dom/client');
  root = createRoot(document.querySelector('#root')!);
});

afterEach(async () => {
  await act(async () => root.unmount());
  dom.window.close();
  for (const [name, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});

describe('TeamInviteRow', () => {
  it('marks an expired invite and renews it instead of copying its link', async () => {
    await render(invite(-1));

    assert.ok(document.body.textContent?.includes(teams.invite.expiredAt.split(' ')[0]));
    assert.equal(button(teams.invite.copyLink), undefined);
    await act(async () => button(teams.invite.renew)!.click());
    assert.deepEqual(renewed, [9]);
  });

  it('offers no renewal to someone who may not renew the invite', async () => {
    await render(invite(-1), { mayRenew: false });

    assert.ok(document.body.textContent?.includes(teams.invite.expiredAt.split(' ')[0]));
    assert.equal(button(teams.invite.renew), undefined);
  });

  it('shows a valid invite as invited, with its link', async () => {
    await render(invite(3));

    assert.ok(document.body.textContent?.includes(teams.invite.pending));
    assert.ok(button(teams.invite.copyLink));
    assert.equal(button(teams.invite.renew), undefined);
  });
});
