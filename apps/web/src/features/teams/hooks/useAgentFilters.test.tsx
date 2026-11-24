import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { NextIntlClientProvider } from 'next-intl';
import { JSDOM } from 'jsdom';
import type { AiAgent } from '@/lib/api/endpoints/agents';
import teams from '../../../../messages/en/teams.json';
import { useAgentFilters } from './useAgentFilters';

let dom: JSDOM;
let root: Root;
let filters: ReturnType<typeof useAgentFilters>;
let originals: Map<string, PropertyDescriptor | undefined>;

const project = (id: number) => ({ id, key: `P${id}`, ref: `P${id}`, name: `Project ${id}` });

const agent = (id: number, overrides: Partial<AiAgent>): AiAgent =>
  ({
    id,
    name: `Agent ${id}`,
    username: `agent-${id}`,
    kind: 'internal',
    projects: [],
    model: null,
    modelProvider: null,
    triggerOnMention: false,
    triggerOnAssign: false,
    fieldTriggers: [],
    ...overrides,
  }) as AiAgent;

const mentioner = agent(1, {
  projects: [project(1)],
  triggerOnMention: true,
  model: 'gpt-5.6-luna',
  modelProvider: 'openai',
});
const delegate = agent(2, { projects: [project(2)], triggerOnAssign: true });
const runner = agent(3, { kind: 'external', projects: [project(1)], triggerOnAssign: true });

function Probe({ agents, defaultIds }: { agents: AiAgent[]; defaultIds: number[] }) {
  filters = useAgentFilters(agents, (key) => key, defaultIds);
  return null;
}

function render(agents: AiAgent[], defaultIds: number[] = []) {
  act(() =>
    root.render(
      <NextIntlClientProvider locale="en" messages={{ teams }} timeZone="UTC">
        <Probe agents={agents} defaultIds={defaultIds} />
      </NextIntlClientProvider>,
    ),
  );
}

const listed = () => filters.filtered.map((a) => a.id);
const tick = (key: string, selected: string[]) => act(() => filters.setFilter(key, selected));

beforeEach(async () => {
  originals = new Map(
    ['window', 'document', 'navigator', 'IS_REACT_ACT_ENVIRONMENT'].map((name) => [
      name,
      Object.getOwnPropertyDescriptor(globalThis, name),
    ]),
  );
  dom = new JSDOM('<!doctype html><div id="root"></div>');
  Object.defineProperties(globalThis, {
    window: { configurable: true, value: dom.window },
    document: { configurable: true, value: dom.window.document },
    navigator: { configurable: true, value: dom.window.navigator },
    IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true },
  });
  const { createRoot } = await import('react-dom/client');
  root = createRoot(document.querySelector('#root')!);
});

afterEach(() => {
  act(() => root.unmount());
  dom.window.close();
  for (const [name, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});

describe('useAgentFilters', () => {
  it('lists an agent matching any ticked value of a section and every section in use', () => {
    render([mentioner, delegate, runner]);
    assert.deepEqual(listed(), [1, 2, 3]);

    tick('project', ['1']);
    assert.deepEqual(listed(), [1, 3]);
    tick('project', ['1', '2']);
    assert.deepEqual(listed(), [1, 2, 3]);
    tick('kind', ['internal']);
    assert.deepEqual(listed(), [1, 2]);
    tick('trigger', ['delegation']);
    assert.deepEqual(listed(), [2]);
  });

  it('narrows by model provider and by joining new projects', () => {
    render([mentioner, delegate, runner], [2]);

    tick('provider', ['openai']);
    assert.deepEqual(listed(), [1]);
    tick('provider', []);
    tick('newProjects', ['on']);
    assert.deepEqual(listed(), [2]);
    tick('newProjects', ['off']);
    assert.deepEqual(listed(), [1, 3]);
  });

  it('searches the name, the username and the model', () => {
    render([mentioner, delegate, runner]);

    act(() => filters.setSearch(' GPT '));
    assert.deepEqual(listed(), [1]);
    act(() => filters.setSearch('agent-3'));
    assert.deepEqual(listed(), [3]);
  });

  it('stops counting a ticked project that no agent works in any more', () => {
    render([mentioner, delegate, runner]);
    tick('project', ['2']);
    assert.deepEqual(listed(), [2]);

    render([mentioner, runner]);
    assert.deepEqual(listed(), [1, 3]);
    assert.deepEqual(filters.projectIds, []);
  });
});
