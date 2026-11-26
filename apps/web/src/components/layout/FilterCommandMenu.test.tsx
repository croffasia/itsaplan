import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act, useState } from 'react';
import type { Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { JSDOM } from 'jsdom';
import * as auth from '@/lib/auth-client';
import type { CustomField } from '@/lib/api/endpoints/customFields';
import type { Assignee, ProjectDetail } from '@/lib/api/endpoints/projects';
import type { FilterSet } from '@/utils/filters';
import common from '../../../messages/en/common.json';
import display from '../../../messages/en/display.json';
import filters from '../../../messages/en/filters.json';

const spyOn = createRequire(import.meta.url)('bun:test').spyOn as (
  target: object,
  method: string,
) => { mockReturnValue(value: unknown): { mockRestore(): void } };

const replacedGlobals = [
  'window',
  'document',
  'navigator',
  'Node',
  'NodeFilter',
  'DocumentFragment',
  'Element',
  'HTMLElement',
  'HTMLInputElement',
  'SVGElement',
  'ShadowRoot',
  'Event',
  'CustomEvent',
  'FocusEvent',
  'KeyboardEvent',
  'MouseEvent',
  'PointerEvent',
  'MutationObserver',
  'getComputedStyle',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'ResizeObserver',
  'fetch',
  'IS_REACT_ACT_ENVIRONMENT',
] as const;

function person(userId: string, name: string, kind: Assignee['kind'] = 'member'): Assignee {
  return {
    userId,
    name,
    email: `${userId}@example.test`,
    username: userId,
    image: null,
    kind,
    agentKind: kind === 'agent' ? 'external' : null,
    restrictedToUserId: null,
    respondsToMention: null,
    canReadWorkItems: true,
    canAssign: true,
  };
}

function issue(id: number, assigneeUserId: string | null, columnId: number) {
  return {
    id,
    columnId,
    assigneeUserId,
    delegateUserId: null,
    priority: null,
    typeId: null,
    initiative: null,
    cycle: null,
    labelIds: [],
    fieldValues: [],
  };
}

const notes = { id: 3, name: 'Notes', fieldType: 'text', options: [] } as unknown as CustomField;

const project = {
  project: { ref: 'eng.P01' },
  columns: [
    { id: 1, name: 'Todo', stateType: 'unstarted', color: '#888888' },
    { id: 2, name: 'Done', stateType: 'completed', color: '#22aa55' },
  ],
  issueTypes: [],
  labels: [],
  labelGroups: [],
  plannedCycles: [],
  assignees: [
    person('peer', 'Bianca Active'),
    person('me', 'Alex Active'),
    person('bot', 'Helper Bot', 'agent'),
  ],
  issues: [issue(1, 'peer', 1), issue(2, 'peer', 2), issue(3, null, 1)],
} as unknown as ProjectDetail;

let dom: JSDOM;
let root: Root;
let originals: Map<string, PropertyDescriptor | undefined>;
let restoreSession: () => void;
let changes: FilterSet[];
let closed: number;

function MenuProbe({ initial }: { initial: FilterSet }) {
  const [set, setSet] = useState(initial);
  return (
    <FilterCommandMenu
      filters={set}
      onChange={(next) => {
        changes.push(next);
        setSet(next);
      }}
      project={project}
      customFields={[notes]}
      onClose={() => closed++}
    />
  );
}

let FilterCommandMenu: typeof import('./FilterCommandMenu').default;

async function render(initial: FilterSet = { conditions: [] }) {
  FilterCommandMenu = (await import('./FilterCommandMenu')).default;
  await act(async () =>
    root.render(
      <QueryClientProvider client={new QueryClient()}>
        <NextIntlClientProvider locale="en" messages={{ common, display, filters }} timeZone="UTC">
          <MenuProbe initial={initial} />
        </NextIntlClientProvider>
      </QueryClientProvider>,
    ),
  );
}

const rows = () => [...document.querySelectorAll<HTMLElement>('[cmdk-item]')];
const texts = () => rows().map((row) => row.textContent?.trim());
const row = (label: string) => rows().find((r) => r.textContent?.includes(label))!;
const input = () => document.querySelector<HTMLInputElement>('[cmdk-input]')!;
const lastConditions = () =>
  changes.at(-1)!.conditions.map(({ field, op, values }) => ({ field, op, values }));

async function type(value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
  await act(async () => {
    setter.call(input(), value);
    input().dispatchEvent(new window.Event('input', { bubbles: true }));
  });
}

async function press(key: string) {
  await act(async () => {
    input().dispatchEvent(new window.KeyboardEvent('keydown', { key, bubbles: true }));
  });
}

beforeEach(async () => {
  originals = new Map(
    replacedGlobals.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  dom = new JSDOM('<!doctype html><div id="root"></div>', {
    url: 'http://localhost/',
    pretendToBeVisual: true,
  });
  for (const name of replacedGlobals) {
    if (name in dom.window) {
      Object.defineProperty(globalThis, name, {
        configurable: true,
        value: dom.window[name as keyof typeof dom.window],
      });
    }
  }
  Object.defineProperties(globalThis, {
    getComputedStyle: { configurable: true, value: dom.window.getComputedStyle.bind(dom.window) },
    requestAnimationFrame: {
      configurable: true,
      value: dom.window.requestAnimationFrame.bind(dom.window),
    },
    cancelAnimationFrame: {
      configurable: true,
      value: dom.window.cancelAnimationFrame.bind(dom.window),
    },
    ResizeObserver: {
      configurable: true,
      value: class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    },
    fetch: { configurable: true, value: async () => Response.json([]) },
    IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true },
  });
  Object.defineProperty(window, '__ITSAPLAN_ENV__', {
    value: { apiUrl: 'https://api.test', privacyUrl: '', termsUrl: '' },
  });
  window.HTMLElement.prototype.scrollIntoView = () => {};
  const session = spyOn(auth, 'useSession').mockReturnValue({
    data: { user: { id: 'me', name: 'Alex Active', image: null } },
    isPending: false,
    error: null,
  });
  restoreSession = () => session.mockRestore();
  changes = [];
  closed = 0;
  const { createRoot } = await import('react-dom/client');
  root = createRoot(document.getElementById('root')!);
});

afterEach(async () => {
  await act(async () => root.unmount());
  restoreSession();
  dom.window.close();
  for (const [name, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});

describe('FilterCommandMenu', () => {
  it('adds a condition in one pick from a value found by typing, across fields', async () => {
    await render();
    assert.ok(texts().includes(filters.fields.assignee));
    assert.ok(!texts().some((text) => text?.includes('Bianca')));

    await type('bian');
    const headings = [
      ...document.querySelectorAll('[cmdk-group]:not([hidden]) [cmdk-group-heading]'),
    ].map((heading) => heading.textContent);
    assert.deepEqual(headings, [filters.fields.assignee]);
    assert.deepEqual(texts(), ['BABianca Active2']);

    await act(async () => row('Bianca Active').click());
    assert.deepEqual(lastConditions(), [{ field: 'assignee', op: 'is', values: ['peer'] }]);
    assert.equal(closed, 1);
  });

  it("lists a person field's values with Me and no value first, counted, ticked into one condition", async () => {
    await render();
    await act(async () => row(filters.fields.assignee).click());
    assert.equal(input().placeholder, `${filters.fields.assignee}…`);
    assert.deepEqual(texts(), [
      `AA${filters.me}0`,
      `${filters.unset.assignee}1`,
      'BABianca Active2',
    ]);
    assert.ok(rows().every((r) => r.getAttribute('aria-checked') === 'false'));

    await act(async () => row('Bianca Active').click());
    await act(async () => row(filters.unset.assignee).click());
    assert.deepEqual(lastConditions(), [{ field: 'assignee', op: 'is', values: ['peer', null] }]);
    assert.equal(row('Bianca Active').getAttribute('aria-checked'), 'true');
    assert.equal(closed, 0);

    await act(async () => row('Bianca Active').click());
    await act(async () => row(filters.unset.assignee).click());
    assert.deepEqual(lastConditions(), []);

    await press('Backspace');
    assert.equal(input().placeholder, filters.menuPlaceholder);
    assert.ok(texts().includes(filters.fields.status));
  });

  it('keeps the focus in the search when a value is ticked with the mouse', async () => {
    await render();
    await act(async () => row(filters.fields.assignee).click());
    const down = new window.MouseEvent('mousedown', { bubbles: true, cancelable: true });
    await act(async () => {
      row('Bianca Active').dispatchEvent(down);
    });
    assert.equal(down.defaultPrevented, true);
  });

  it("ticks join the field's existing condition", async () => {
    await render({ conditions: [{ id: 'c1', field: 'status', op: 'is', values: [1] }] });
    await act(async () => row(filters.fields.status).click());
    assert.equal(row('Todo').getAttribute('aria-checked'), 'true');
    await act(async () => row('Done').click());
    assert.deepEqual(lastConditions(), [{ field: 'status', op: 'is', values: [1, 2] }]);
  });

  it('adds what is typed for a text field', async () => {
    await render();
    await act(async () => row('Notes').click());
    await type('launch');
    assert.deepEqual(texts(), [`Notes ${filters.operators.contains} launch`]);
    await act(async () => rows()[0].click());
    assert.deepEqual(lastConditions(), [{ field: 'cf:3', op: 'contains', values: ['launch'] }]);
    assert.equal(closed, 1);
  });
});
