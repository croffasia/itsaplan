import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { NextIntlClientProvider } from 'next-intl';
import { JSDOM } from 'jsdom';
import type { Issue } from '@/lib/api/endpoints/issues';
import type { Maps } from '@/utils/project';
import workItems from '../../../../../messages/en/workItems.json';
import { SubtasksProvider } from '../../context/useSubtasks';
import { IssueCardSubtasks } from './IssueCardSubtasks';

const globals = [
  'window',
  'document',
  'navigator',
  'Node',
  'Element',
  'HTMLElement',
  'IS_REACT_ACT_ENVIRONMENT',
] as const;

const maps: Maps = {
  typeById: new Map(),
  labelById: new Map(),
  assigneeById: new Map(),
  columnById: new Map(),
};

const issue = (id: number, parentId: number, title: string) =>
  ({ id, parentId, title, columnId: 1, sequenceNumber: id, identifier: `WEEKUP-${id}` }) as Issue;
const issues = [
  issue(2, 1, 'Trial preparation'),
  issue(3, 1, 'Release documents'),
  issue(4, 2, 'Trial checklist'),
  issue(5, 3, 'Publish notes'),
  issue(6, 4, 'Confirm equipment'),
];

let dom: JSDOM;
let root: Root;
let originals: Map<string, PropertyDescriptor | undefined>;
let opened: number[];
let cardEvents: string[];

beforeEach(async () => {
  originals = new Map(
    globals.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  dom = new JSDOM('<!doctype html><div id="root"></div>');
  for (const name of globals) {
    Object.defineProperty(globalThis, name, {
      configurable: true,
      value: name === 'IS_REACT_ACT_ENVIRONMENT' ? true : dom.window[name],
    });
  }
  const { createRoot } = await import('react-dom/client');
  root = createRoot(document.querySelector('#root')!);
  opened = [];
  cardEvents = [];
});

afterEach(() => {
  act(() => root.unmount());
  dom.window.close();
  for (const [name, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});

function render(collapsed: boolean) {
  act(() =>
    root.render(
      <NextIntlClientProvider locale="en" messages={{ workItems }} timeZone="UTC">
        <div
          onClick={() => cardEvents.push('click')}
          onMouseDown={() => cardEvents.push('mousedown')}
          onTouchStart={() => cardEvents.push('touchstart')}
          onPointerDown={() => cardEvents.push('pointerdown')}
          onKeyDown={(event) => {
            event.preventDefault();
            cardEvents.push('keydown');
          }}
        >
          <SubtasksProvider issues={issues} enabled collapsed={collapsed}>
            <IssueCardSubtasks issueId={1} maps={maps} onOpen={(id) => opened.push(id)} />
          </SubtasksProvider>
        </div>
      </NextIntlClientProvider>,
    ),
  );
}

const button = (text: string) =>
  [...document.querySelectorAll('button')].find((element) => element.textContent?.includes(text));

function toggleFor(title: string) {
  const toggle =
    button(title)?.parentElement?.querySelector<HTMLButtonElement>('button[aria-expanded]');
  assert.ok(toggle, `Expected a subtask toggle beside ${title}`);
  return toggle;
}

describe('IssueCardSubtasks', () => {
  it('shows two levels by default and follows the default folding setting', () => {
    render(false);
    assert.ok(button('Trial checklist'));
    assert.ok(button('Publish notes'));
    assert.equal(button('Confirm equipment'), undefined);

    render(true);
    assert.equal(button('Trial preparation'), undefined);
    act(() => button('Subtasks 0/2')!.click());
    assert.equal(toggleFor('Trial preparation').getAttribute('aria-expanded'), 'false');
    assert.equal(button('Trial checklist'), undefined);
    assert.equal(button('Publish notes'), undefined);

    render(false);
    assert.ok(button('Trial checklist'));
    assert.ok(button('Publish notes'));
  });

  it('toggles branches independently and keeps leaf rows free of toggles', () => {
    render(false);
    const trial = toggleFor('Trial preparation');
    assert.ok(trial.textContent?.includes('0/1'));
    act(() => trial.click());
    assert.equal(button('Trial checklist'), undefined);
    assert.ok(button('Publish notes'));

    act(() => trial.click());
    const checklist = toggleFor('Trial checklist');
    assert.equal(checklist.getAttribute('aria-expanded'), 'false');
    act(() => checklist.click());
    assert.ok(button('Confirm equipment'));
    assert.equal(
      button('Confirm equipment')!.parentElement?.querySelector('[aria-expanded]'),
      null,
    );
  });

  it('keeps navigation and the parent card controls separate from the count', () => {
    render(false);
    const toggle = toggleFor('Release documents');
    act(() => {
      for (const type of ['mousedown', 'touchstart', 'pointerdown']) {
        toggle.dispatchEvent(new dom.window.Event(type, { bubbles: true }));
      }
      for (const [key, code] of [
        ['Enter', 'Enter'],
        [' ', 'Space'],
      ]) {
        const event = new dom.window.KeyboardEvent('keydown', {
          key,
          code,
          bubbles: true,
          cancelable: true,
        });
        assert.equal(toggle.dispatchEvent(event), true);
      }
      toggle.click();
    });
    assert.equal(button('Publish notes'), undefined);
    assert.deepEqual(opened, []);

    act(() => button('Release documents')!.click());
    act(() => button('Trial checklist')!.click());
    assert.deepEqual(opened, [3, 4]);
    assert.deepEqual(cardEvents, []);
  });
});
