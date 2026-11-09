import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { NextIntlClientProvider } from 'next-intl';
import { JSDOM } from 'jsdom';
import type { AiAgent } from '@/lib/api/endpoints/agents';
import teams from '../../../../../messages/en/teams.json';
import common from '../../../../../messages/en/common.json';
import { AgentSectionProvider } from '../../context/agentSection';

// Editing or deleting an agent acts on it in every project it works in, so a member who
// shares only some of them is offered neither, although their role may edit agents.
const replacedGlobals = [
  'window',
  'document',
  'navigator',
  'Node',
  'NodeFilter',
  'DocumentFragment',
  'Element',
  'HTMLElement',
  'HTMLButtonElement',
  'SVGElement',
  'ShadowRoot',
  'Event',
  'CustomEvent',
  'MouseEvent',
  'KeyboardEvent',
  'MutationObserver',
  'getComputedStyle',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'IS_REACT_ACT_ENVIRONMENT',
] as const;

let dom: JSDOM;
let root: Root;
let originals: Map<string, PropertyDescriptor | undefined>;
let edited = 0;

const agent = (canManage: boolean): AiAgent => ({
  id: 4,
  teamId: 1,
  projects: [{ id: 1, key: 'MKT', ref: 'MKT', name: 'Marketing' }],
  userId: 'bot',
  name: 'Bot',
  username: 'bot',
  kind: 'internal',
  modelCredentialId: null,
  model: null,
  instructions: null,
  tools: [],
  temperature: null,
  reasoningEffort: null,
  maxSteps: null,
  runTimeoutSec: null,
  memoryEnabled: false,
  memoryLastMessages: null,
  triggerOnMention: false,
  triggerOnAssign: false,
  fieldTriggers: [],
  delegationDelaySec: 0,
  ownerUserId: null,
  runnerScope: 'team',
  lastSeenAt: null,
  invocationUrl: null,
  createdAt: new Date(0).toISOString(),
  apiKeyStart: null,
  modelProvider: null,
  actionCount: 0,
  skillCount: 0,
  toolCount: 0,
  canManage,
  chatEnabled: true,
});

async function render(row: AiAgent) {
  const { TeamAiAgentRow } = await import('./TeamAiAgentRow');
  await act(async () =>
    root.render(
      <NextIntlClientProvider locale="en" messages={{ teams, common }} timeZone="UTC">
        <AgentSectionProvider
          teamId={1}
          permissions={{ read: true, create: true, edit: true, delete: true }}
        >
          <table>
            <tbody>
              <TeamAiAgentRow
                agent={row}
                providerLabel={(key) => key}
                onChat={() => {}}
                onRuns={() => {}}
                onEdit={() => {
                  edited += 1;
                }}
                onDelete={() => {}}
                joinsNewProjects={false}
                joinsNewProjectsPending={false}
              />
            </tbody>
          </table>
        </AgentSectionProvider>
      </NextIntlClientProvider>,
    ),
  );
}

// The items of the row's menu, once it is open.
async function menuItems(): Promise<string[]> {
  const trigger = document.querySelector('button[aria-haspopup="menu"]')!;
  await act(async () => {
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  });
  return [...document.querySelectorAll('[role="menuitem"]')].map((i) => i.textContent ?? '');
}

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
  edited = 0;
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

describe('TeamAiAgentRow', () => {
  it('opens the editor and offers deleting an agent the viewer may manage', async () => {
    await render(agent(true));

    await act(async () => (document.querySelector('tr') as HTMLElement).click());
    assert.equal(edited, 1);
    const items = await menuItems();
    assert.ok(items.some((i) => i.includes(common.edit)));
    assert.ok(items.some((i) => i.includes(common.delete)));
  });

  it('offers neither editing nor deleting an agent the viewer may not manage', async () => {
    await render(agent(false));

    await act(async () => (document.querySelector('tr') as HTMLElement).click());
    assert.equal(edited, 0);
    const items = await menuItems();
    assert.ok(items.some((i) => i.includes(teams.agents.runHistory)));
    assert.ok(!items.some((i) => i.includes(common.edit)));
    assert.ok(!items.some((i) => i.includes(common.delete)));
  });

  it('offers the test chat of an agent with chat on', async () => {
    await render(agent(true));

    assert.ok((await menuItems()).some((i) => i.includes(teams.agents.testChat)));
  });

  it('does not offer the test chat of an agent with chat off', async () => {
    await render({ ...agent(true), chatEnabled: false });

    assert.ok(!(await menuItems()).some((i) => i.includes(teams.agents.testChat)));
  });
});
