import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { NextIntlClientProvider } from 'next-intl';
import { JSDOM } from 'jsdom';
import type { AiAgent } from '@/lib/api/endpoints/agents';
import teams from '../../../../../messages/en/teams.json';
import common from '../../../../../messages/en/common.json';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AgentSectionProvider } from '../../context/agentSection';

// The sheet also opens for the test chat. It offers saving only to a viewer who may
// change the agent: a role that edits agents, on an agent whose projects they all share.
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
  'HTMLFormElement',
  'ResizeObserver',
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
  'fetch',
] as const;

let dom: JSDOM;
let root: Root;
let originals: Map<string, PropertyDescriptor | undefined>;

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

async function render(row: AiAgent, edit = true) {
  const { AgentSheetForm } = await import('./AgentSheetForm');
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <NextIntlClientProvider locale="en" messages={{ teams, common }} timeZone="UTC">
          <AgentSectionProvider
            teamId={1}
            permissions={{ read: true, create: true, edit, delete: true }}
          >
            <AgentSheetForm agent={row} onCreated={() => {}} />
          </AgentSectionProvider>
        </NextIntlClientProvider>
      </QueryClientProvider>,
    ),
  );
}

const saveButton = () =>
  [...document.querySelectorAll('button[type="submit"]')].find((b) =>
    b.textContent?.includes(teams.agents.save),
  );

beforeEach(async () => {
  originals = new Map(
    replacedGlobals.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  dom = new JSDOM('<!doctype html><div id="root"></div>', {
    url: 'https://example.test/',
    pretendToBeVisual: true,
  });
  Object.assign(dom.window, {
    __ITSAPLAN_ENV__: { apiUrl: 'http://api.test', privacyUrl: '', termsUrl: '' },
  });
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
  // The agent form's switches measure themselves; jsdom has no ResizeObserver.
  Object.defineProperty(globalThis, 'ResizeObserver', {
    configurable: true,
    value: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  });
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    value: async () => Response.json({ error: 'Access denied' }, { status: 403 }),
  });
  const { createRoot } = await import('react-dom/client');
  root = createRoot(document.querySelector('#root')!);
});

afterEach(async () => {
  await act(async () => root.unmount());
  // The instructions editor tears down after the unmount; let it run while the page exists.
  await new Promise((resolve) => setTimeout(resolve, 0));
  dom.window.close();
  for (const [name, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});

describe('AgentSheetForm', () => {
  it('offers saving an agent the viewer may change', async () => {
    await render(agent(true));

    assert.ok(saveButton());
  });

  it('offers no saving on an agent the viewer may not manage', async () => {
    await render(agent(false));

    assert.equal(saveButton(), undefined);
  });

  it('offers no saving to a role that does not edit agents', async () => {
    await render(agent(true), false);

    assert.equal(saveButton(), undefined);
  });
});
