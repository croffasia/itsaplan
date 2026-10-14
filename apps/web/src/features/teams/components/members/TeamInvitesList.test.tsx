import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { NextIntlClientProvider } from 'next-intl';
import { JSDOM } from 'jsdom';
import type { InviteRow } from '@/lib/api/endpoints/invites';
import members from '../../../../../messages/en/members.json';
import teams from '../../../../../messages/en/teams.json';
import common from '../../../../../messages/en/common.json';

// One address with several invites is listed once, with a line for each invite.
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

const DAY = 24 * 60 * 60 * 1000;
const invite = (
  id: number,
  email: string,
  projectName: string | null,
  expiresInDays = 3,
): InviteRow => ({
  id,
  token: `tok-${id}`,
  email,
  teamRole: projectName ? 'member' : 'manager',
  projectKey: projectName ? 'MKT' : null,
  projectName,
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

async function render(rows: InviteRow[]) {
  const { default: TeamInvitesList } = await import('./TeamInvitesList');
  await act(async () =>
    root.render(
      <NextIntlClientProvider locale="en" messages={{ teams, members, common }} timeZone="UTC">
        <TeamInvitesList
          invites={rows}
          onRevoke={() => {}}
          onRenew={() => {}}
          canRenew={() => true}
          renewingId={null}
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

describe('TeamInvitesList', () => {
  it('lists an address once, with a line for each invite it holds', async () => {
    await render([
      invite(1, 'ada@example.test', null),
      invite(2, 'ada@example.test', 'Marketing'),
      invite(3, 'bob@example.test', null, -1),
    ]);

    const text = document.body.textContent ?? '';
    assert.equal(text.split('ada@example.test').length - 1, 1);
    assert.ok(text.includes(teams.invite.joinsTeam));
    assert.ok(text.includes(teams.invite.joinsProject.replace('{project}', 'Marketing')));
    assert.ok(text.includes('3 pending invites'));
    assert.ok(button(teams.invite.renew));
  });
});
