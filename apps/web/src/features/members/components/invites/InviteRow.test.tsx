import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { NextIntlClientProvider } from 'next-intl';
import { JSDOM } from 'jsdom';
import type { InviteRow as Invite } from '@/lib/api/endpoints/invites';
import members from '../../../../../messages/en/members.json';
import common from '../../../../../messages/en/common.json';

// An expired invite has a dead link: the row offers a renewal instead of copying or
// mailing it.
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
const invite = (expiresInDays: number): Invite => ({
  id: 7,
  token: 'tok',
  email: 'ada@example.test',
  teamRole: 'member',
  projectKey: 'MKT',
  projectName: 'Marketing',
  role: 'member',
  roleId: null,
  roleName: null,
  status: 'pending',
  createdAt: new Date(Date.now() - 8 * DAY).toISOString(),
  expiresAt: new Date(Date.now() + expiresInDays * DAY).toISOString(),
  respondedAt: null,
  invitedByName: null,
  invitedByEmail: null,
});

async function render(row: Invite) {
  const { default: InviteRow } = await import('./InviteRow');
  await act(async () =>
    root.render(
      <NextIntlClientProvider locale="en" messages={{ members, common }} timeZone="UTC">
        <InviteRow
          invite={row}
          onResend={() => {}}
          onRenew={(i) => renewed.push(i.id)}
          resending={false}
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

describe('InviteRow', () => {
  it('offers to renew an expired invite, not to copy or mail its link', async () => {
    await render(invite(-1));

    assert.ok(document.body.textContent?.includes(members.invites.status.expired));
    assert.equal(button(members.invites.copyLink), undefined);
    assert.equal(button(members.invites.resendEmail), undefined);
    await act(async () => button(members.invites.renew)!.click());
    assert.deepEqual(renewed, [7]);
  });

  it('keeps the link and email actions for an invite still valid', async () => {
    await render(invite(3));

    assert.ok(button(members.invites.copyLink));
    assert.ok(button(members.invites.resendEmail));
    assert.equal(button(members.invites.renew), undefined);
  });
});
