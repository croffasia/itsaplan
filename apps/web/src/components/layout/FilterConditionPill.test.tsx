import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act, useState } from 'react';
import type { Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { JSDOM } from 'jsdom';
import * as auth from '@/lib/auth-client';
import type { Assignee, ProjectDetail } from '@/lib/api/endpoints/projects';
import type { FilterCondition } from '@/utils/filters';
import { useFilterFields } from '@/hooks/useFilterFields';
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
  'HTMLFormElement',
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
  'IS_REACT_ACT_ENVIRONMENT',
] as const;

function person(userId: string, name: string): Assignee {
  return {
    userId,
    name,
    email: `${userId}@example.test`,
    username: userId,
    image: null,
    kind: 'member',
    agentKind: null,
    restrictedToUserId: null,
    respondsToMention: null,
    canReadWorkItems: true,
    canAssign: true,
  };
}

const project = {
  project: { ref: 'eng.P01' },
  columns: [],
  issueTypes: [],
  labels: [],
  labelGroups: [],
  plannedCycles: [],
  assignees: [person('peer', 'Bianca Active'), person('me', 'Alex Active')],
  issues: [],
} as unknown as ProjectDetail;

let dom: JSDOM;
let root: Root;
let originals: Map<string, PropertyDescriptor | undefined>;
let restoreSession: () => void;
let removed: number;

function PillProbe({ initial }: { initial: FilterCondition }) {
  const [cond, setCond] = useState(initial);
  const spec = useFilterFields()
    .fieldSpecs(project, [])
    .find((s) => s.field === cond.field)!;
  return (
    <FilterConditionPill
      spec={spec}
      cond={cond}
      project={project}
      onOperatorChange={(op) => setCond({ ...cond, op })}
      onValuesChange={(values) => setCond({ ...cond, values })}
      onRemove={() => removed++}
    />
  );
}

let FilterConditionPill: typeof import('./FilterConditionPill').default;

async function render(cond: FilterCondition) {
  FilterConditionPill = (await import('./FilterConditionPill')).default;
  await act(async () =>
    root.render(
      <QueryClientProvider client={new QueryClient()}>
        <NextIntlClientProvider locale="en" messages={{ common, display, filters }} timeZone="UTC">
          <PillProbe initial={cond} />
        </NextIntlClientProvider>
      </QueryClientProvider>,
    ),
  );
}

const chip = () => document.querySelector<HTMLElement>('#root > div')!;
const parts = () => [...chip().children].map((part) => part.textContent?.trim());
const valuesButton = () => chip().children[2] as HTMLElement;
const menuRow = (label: string) =>
  [...document.querySelectorAll<HTMLElement>('[cmdk-item]')].find((r) =>
    r.textContent?.includes(label),
  )!;

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
    IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true },
  });
  window.HTMLElement.prototype.scrollIntoView = () => {};
  const session = spyOn(auth, 'useSession').mockReturnValue({
    data: { user: { id: 'me', name: 'Alex Active', image: null } },
    isPending: false,
    error: null,
  });
  restoreSession = () => session.mockRestore();
  removed = 0;
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

describe('FilterConditionPill', () => {
  it('reads "is any of" for several values, with their avatars and names', async () => {
    await render({ id: 'c1', field: 'assignee', op: 'is', values: ['peer', 'me'] });
    assert.deepEqual(parts(), [
      filters.fields.assignee,
      filters.isAnyOf,
      `BAAABianca Active, ${filters.me}`,
      '',
    ]);
    const remove = chip().children[3] as HTMLElement;
    assert.equal(
      remove.getAttribute('aria-label'),
      common.removeFilter.replace('{filter}', filters.fields.assignee),
    );
    await act(async () => remove.click());
    assert.equal(removed, 1);
  });

  it('opens the value list from its values, ticked, and edits the condition there', async () => {
    await render({ id: 'c1', field: 'assignee', op: 'is', values: ['peer', 'me'] });
    await act(async () => valuesButton().click());
    assert.equal(menuRow(filters.me).getAttribute('aria-checked'), 'true');
    assert.equal(menuRow(filters.unset.assignee).getAttribute('aria-checked'), 'false');

    await act(async () => menuRow(filters.me).click());
    assert.deepEqual(parts().slice(1, 3), [filters.operators.is, 'BABianca Active']);
  });

  it('shows a muted placeholder for a condition with no value yet', async () => {
    await render({ id: 'c1', field: 'dueDate', op: 'before', values: [] });
    const placeholder = valuesButton().querySelector('span');
    assert.equal(placeholder?.textContent, filters.valuePlaceholder);
    assert.ok(placeholder?.className.includes('text-muted-foreground'));
  });
});
