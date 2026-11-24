import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { NextIntlClientProvider } from 'next-intl';
import { JSDOM } from 'jsdom';
import * as auth from '@/lib/auth-client';
import type { Assignee } from '@/lib/api/endpoints/projects';
import issueMessages from '../../../../messages/en/issue.json';

type SessionSnapshot = ReturnType<typeof auth.useSession>;
const { spyOn } = createRequire(import.meta.url)('bun:test') as {
  spyOn(
    target: object,
    method: string,
  ): {
    mockImplementation(fn: () => SessionSnapshot): { mockRestore(): void };
  };
};

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
  'HTMLInputElement',
  'SVGElement',
  'ShadowRoot',
  'DOMRect',
  'Event',
  'CustomEvent',
  'MouseEvent',
  'PointerEvent',
  'KeyboardEvent',
  'MutationObserver',
  'getComputedStyle',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'ResizeObserver',
  'IS_REACT_ACT_ENVIRONMENT',
] as const;

class FakeResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

function candidate(overrides: Partial<Assignee> & { userId: string; name: string }): Assignee {
  return {
    email: `${overrides.userId}@example.test`,
    username: overrides.userId,
    image: null,
    kind: 'member',
    agentKind: null,
    restrictedToUserId: null,
    respondsToMention: null,
    canReadWorkItems: true,
    canAssign: true,
    ...overrides,
  };
}

const assignees: Assignee[] = [
  candidate({ userId: 'me', name: 'Alex Active', canAssign: true }),
  candidate({ userId: 'peer', name: 'Bianca Active', canAssign: true }),
  candidate({ userId: 'ex', name: 'Carlos Departed', canAssign: false }),
  candidate({ userId: 'bot', name: 'Helper Bot', kind: 'agent', agentKind: 'external' }),
];

let dom: JSDOM;
let root: Root;
let originals: Map<string, PropertyDescriptor | undefined>;
let restoreSession: () => void;

const settle = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 20)));

async function renderSelect(props: {
  value: string | null;
  onChange?: (userId: string | null) => void;
  readOnly?: boolean;
}) {
  // Dynamically imported after JSDOM globals are installed so Radix's useLayoutEffect
  // binds to React.useLayoutEffect and portals mount into document.body.
  const { default: AssigneeSelect } = await import('./AssigneeSelect');
  await act(() =>
    root.render(
      <NextIntlClientProvider locale="en" timeZone="UTC" messages={{ issue: issueMessages }}>
        <AssigneeSelect
          assignees={assignees}
          value={props.value}
          onChange={props.onChange ?? (() => {})}
          readOnly={props.readOnly}
        />
      </NextIntlClientProvider>,
    ),
  );
  await settle();
}

function optionItems() {
  return [...document.querySelectorAll<HTMLElement>('[data-slot="command-item"]')];
}

beforeEach(async () => {
  dom = new JSDOM('<div id="root"></div>', { url: 'https://planner.test' });
  dom.window.Element.prototype.scrollIntoView = () => {};
  const globals: Record<string, unknown> = {
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    Node: dom.window.Node,
    NodeFilter: dom.window.NodeFilter,
    DocumentFragment: dom.window.DocumentFragment,
    Element: dom.window.Element,
    HTMLElement: dom.window.HTMLElement,
    HTMLButtonElement: dom.window.HTMLButtonElement,
    HTMLInputElement: dom.window.HTMLInputElement,
    SVGElement: dom.window.SVGElement,
    ShadowRoot: dom.window.ShadowRoot,
    DOMRect: dom.window.DOMRect,
    Event: dom.window.Event,
    CustomEvent: dom.window.CustomEvent,
    MouseEvent: dom.window.MouseEvent,
    PointerEvent: dom.window.PointerEvent,
    KeyboardEvent: dom.window.KeyboardEvent,
    MutationObserver: dom.window.MutationObserver,
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    requestAnimationFrame: (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0),
    cancelAnimationFrame: (id: number) => clearTimeout(id),
    ResizeObserver: FakeResizeObserver,
    IS_REACT_ACT_ENVIRONMENT: true,
  };
  originals = new Map(
    replacedGlobals.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]),
  );
  for (const key of replacedGlobals) {
    Object.defineProperty(globalThis, key, { configurable: true, value: globals[key] });
  }
  const mock = spyOn(auth, 'useSession').mockImplementation(
    () =>
      ({
        data: { user: { id: 'me' }, session: { id: 'session-me' } },
        isPending: false,
        error: null,
      }) as SessionSnapshot,
  );
  restoreSession = () => mock.mockRestore();
  const { createRoot } = await import('react-dom/client');
  root = createRoot(document.getElementById('root')!);
});

afterEach(async () => {
  await act(() => root.unmount());
  restoreSession();
  for (const [key, desc] of originals) {
    if (desc) Object.defineProperty(globalThis, key, desc);
    else delete (globalThis as Record<string, unknown>)[key];
  }
  dom.window.close();
});

describe('AssigneeSelect', () => {
  it('offers active members and leaves out deactivated accounts and agents', async () => {
    await renderSelect({ value: null });
    const trigger = document.querySelector<HTMLButtonElement>('button');
    assert.ok(trigger);
    await act(() => trigger.click());
    await settle();

    const labels = optionItems().map((el) => el.textContent?.trim() ?? '');
    assert.ok(labels.some((l) => l.includes('No assignee')));
    assert.ok(labels.some((l) => l.includes('Alex Active')));
    assert.ok(labels.some((l) => l.includes('Bianca Active')));
    assert.ok(!labels.some((l) => l.includes('Carlos Departed')));
    assert.ok(!labels.some((l) => l.includes('Helper Bot')));
  });

  it('still shows an already-assigned deactivated person and lets the user clear or replace them', async () => {
    const picked: (string | null)[] = [];
    await renderSelect({ value: 'ex', onChange: (id) => picked.push(id) });

    const trigger = document.querySelector<HTMLButtonElement>('button');
    assert.ok(trigger);
    assert.ok(trigger.textContent?.includes('Carlos Departed'));

    await act(() => trigger.click());
    await settle();

    const items = optionItems();
    assert.ok(!items.some((el) => el.textContent?.includes('Carlos Departed')));

    const clearItem = items.find((el) => el.textContent?.includes('No assignee'));
    assert.ok(clearItem);
    await act(() => clearItem.click());
    await settle();
    assert.deepEqual(picked, [null]);

    await act(() => trigger.click());
    await settle();
    const activeItem = optionItems().find((el) => el.textContent?.includes('Bianca Active'));
    assert.ok(activeItem);
    await act(() => activeItem.click());
    await settle();
    assert.deepEqual(picked, [null, 'peer']);
  });

  it('still displays a deactivated assignee when read-only', async () => {
    await renderSelect({ value: 'ex', readOnly: true });
    assert.ok(document.body.textContent?.includes('Carlos Departed'));
  });
});
