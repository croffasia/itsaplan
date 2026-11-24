import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { NextIntlClientProvider } from 'next-intl';
import { JSDOM } from 'jsdom';
import type { CrossProjectIssueHit, IssueSearchHit } from '@/lib/api/endpoints/issues';
import palette from '../../../messages/en/palette.json';
import common from '../../../messages/en/common.json';

const replacedGlobals = [
  'window',
  'document',
  'navigator',
  'Node',
  'Element',
  'HTMLElement',
  'SVGElement',
  'Event',
  'MutationObserver',
  'getComputedStyle',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'ResizeObserver',
  'IS_REACT_ACT_ENVIRONMENT',
] as const;

function hit(id: number, identifier: string, title: string): IssueSearchHit {
  return {
    id,
    sequenceNumber: Number(identifier.split('-')[1]),
    identifier,
    title,
    columnId: 1,
    typeId: null,
    initiativeId: null,
    cycleId: null,
    parentId: null,
    assigneeUserId: null,
    delegateUserId: null,
    priority: null,
    dueDate: null,
    labelIds: [],
    archived: false,
  };
}

const current = [hit(1, 'MKT-1', 'Launch plan'), hit(2, 'MKT-2', 'Launch budget')];

function other(
  id: number,
  identifier: string,
  project: { id: number; key: string; name: string; team: string },
): CrossProjectIssueHit {
  return {
    ...hit(id, identifier, `Launch ${identifier}`),
    projectId: project.id,
    projectRef: `eng.${project.key}`,
    projectKey: project.key,
    projectName: project.name,
    teamName: project.team,
  };
}

const ops = { id: 2, key: 'OPS', name: 'Operations', team: 'Engineering' };
const doc = { id: 3, key: 'DOC', name: 'Docs', team: 'Engineering' };
const sup = { id: 4, key: 'SUP', name: 'Helpdesk', team: 'Support' };
// Server order: OPS's best hit first, then DOC's, then SUP's.
const others = [
  other(3, 'OPS-1', ops),
  other(4, 'DOC-1', doc),
  other(5, 'OPS-2', ops),
  other(6, 'SUP-1', sup),
];

let dom: JSDOM;
let root: Root;
let originalGlobalDescriptors: Map<string, PropertyDescriptor | undefined>;
let opened: string[];

async function render(otherHits = others, fetching = false) {
  const { Command, CommandList } = await import('@/components/ui/command');
  const { substringFilter } = await import('@/utils/commandFilter');
  const { default: CommandPaletteIssues } = await import('./CommandPaletteIssues');
  const { default: CommandPaletteOtherIssues } = await import('./CommandPaletteOtherIssues');
  await act(async () =>
    root.render(
      <NextIntlClientProvider locale="en" messages={{ palette, common }} timeZone="UTC">
        <Command filter={substringFilter}>
          <CommandList>
            <CommandPaletteIssues
              heading="Issues"
              hits={current}
              fetching={false}
              onOpenIssue={(issue) => opened.push(issue.identifier)}
            />
            <CommandPaletteOtherIssues
              hits={otherHits}
              fetching={fetching}
              loadingHeading="Issues in other projects"
              onOpenIssue={(issue) => opened.push(`${issue.projectRef}/${issue.sequenceNumber}`)}
            />
          </CommandList>
        </Command>
      </NextIntlClientProvider>,
    ),
  );
}

beforeEach(async () => {
  originalGlobalDescriptors = new Map(
    replacedGlobals.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  dom = new JSDOM('<!doctype html><div id="root"></div>', { pretendToBeVisual: true });
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
  opened = [];
  const { createRoot } = await import('react-dom/client');
  root = createRoot(document.querySelector('#root')!);
});

afterEach(async () => {
  await act(async () => root.unmount());
  dom.window.close();
  for (const [name, descriptor] of originalGlobalDescriptors) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});

const headings = () =>
  [...document.querySelectorAll('[cmdk-group-heading]')].map((el) => el.textContent);
const rows = () => [...document.querySelectorAll<HTMLElement>('[cmdk-item]')];

describe('CommandPaletteOtherIssues', () => {
  it('groups the other projects by project below the current one, in server order', async () => {
    await render();
    assert.deepEqual(headings(), [
      'Issues',
      'Engineering / OperationsOPS',
      'Engineering / DocsDOC',
      'Support / HelpdeskSUP',
    ]);
    assert.deepEqual(
      rows().map((row) => row.textContent),
      [
        'Launch planMKT-1',
        'Launch budgetMKT-2',
        'Launch OPS-1OPS-1',
        'Launch OPS-2OPS-2',
        'Launch DOC-1DOC-1',
        'Launch SUP-1SUP-1',
      ],
    );
    assert.equal(new Set(rows().map((row) => row.dataset.value)).size, 6);
  });

  it('shows one searching row until the first hits arrive', async () => {
    await render([], true);
    assert.deepEqual(headings(), ['Issues', 'Issues in other projects']);
    assert.equal(rows().at(-1)!.textContent, 'Searching…');
  });

  it('opens the hit that was selected', async () => {
    await render();
    await act(async () => rows().at(-1)!.click());
    assert.deepEqual(opened, ['eng.SUP/1']);
  });
});
