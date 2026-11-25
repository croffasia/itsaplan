import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { NextIntlClientProvider } from 'next-intl';
import { JSDOM } from 'jsdom';
import type { PermissionCatalog, Permissions } from '@/lib/api/endpoints/roles';
import { matrixFromCatalog } from '@/utils/permissions';
import permissions from '../../../../messages/en/permissions.json';

const replacedGlobals = [
  'window',
  'document',
  'navigator',
  'Node',
  'Element',
  'HTMLElement',
  'Event',
  'MouseEvent',
  'getComputedStyle',
  'IS_REACT_ACT_ENVIRONMENT',
] as const;

const catalog = {
  resources: [
    { key: 'work_items', actions: ['read', 'create', 'edit', 'delete'] },
    { key: 'workflow_config', actions: ['read', 'edit'] },
    { key: 'danger_zone', actions: ['read', 'delete'] },
  ],
  actions: ['read', 'create', 'edit', 'delete'],
} as PermissionCatalog;

const all = { read: true, create: true, edit: true, delete: true };
const none = matrixFromCatalog(catalog, {});
const full = matrixFromCatalog(catalog, {
  work_items: all,
  workflow_config: all,
  danger_zone: all,
});

let dom: JSDOM;
let root: Root;
let originals: Map<string, PropertyDescriptor | undefined>;

// What the matrix becomes once the checkbox with this label is clicked.
async function clicked(matrix: Permissions, label: string): Promise<Permissions> {
  const { default: RoleEditorMatrix } = await import('./RoleEditorMatrix');
  let next = matrix;
  await act(async () =>
    root.render(
      <NextIntlClientProvider locale="en" messages={{ permissions }} timeZone="UTC">
        <RoleEditorMatrix
          catalog={catalog}
          matrix={matrix}
          gaps={[]}
          onChange={(changed) => (next = changed)}
        />
      </NextIntlClientProvider>,
    ),
  );
  await act(async () =>
    document.querySelector<HTMLElement>(`button[aria-label="${label}"]`)!.click(),
  );
  return next;
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
  Object.defineProperties(globalThis, {
    getComputedStyle: { configurable: true, value: dom.window.getComputedStyle.bind(dom.window) },
    IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true },
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

describe('RoleEditorMatrix', () => {
  it('switches a cell with the ones before it on, and with the ones after it off', async () => {
    const granted = await clicked(none, 'Work items: Edit');
    assert.deepEqual(granted, { ...none, work_items: { ...all, delete: false } });

    const denied = await clicked(full, 'Work items: Create');
    assert.deepEqual(denied, { ...full, work_items: { ...none.work_items, read: true } });
  });

  it('switches a column in the resources that have no such action too', async () => {
    assert.deepEqual(await clicked(none, 'Toggle Delete for all resources'), full);

    const denied = await clicked(full, 'Toggle Edit for all resources');
    assert.equal(denied.danger_zone.delete, false);
    assert.equal(denied.danger_zone.read, true);
    assert.equal(denied.workflow_config.edit, false);
    assert.equal(denied.work_items.create, true);
  });

  it('offers no column toggle in a group where no resource has the action', async () => {
    await clicked(none, 'Toggle Delete for Project');
    assert.equal(document.querySelector('button[aria-label="Toggle Edit for Project"]'), null);
  });
});
