import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { APP_NAME } from '@/utils/app';
import { titlePath, useDocumentTitle } from './useDocumentTitle';

const replacedGlobals = ['window', 'document', 'IS_REACT_ACT_ENVIRONMENT'];

let dom: JSDOM;
let root: Root;
let saved: Map<string, PropertyDescriptor | undefined>;

type Titles = { section: string | null; page?: string | null; panel?: string | null };

function Panel({ title }: { title: string | null }) {
  useDocumentTitle(title, 'panel');
  return null;
}

function Page({ title }: { title: string | null }) {
  useDocumentTitle(title);
  return null;
}

function Section({ section, page, panel }: Titles) {
  useDocumentTitle(section, 'section');
  return (
    <>
      {page !== undefined && <Page title={page} />}
      {panel !== undefined && <Panel title={panel} />}
    </>
  );
}

function setGlobal(name: string, value: unknown) {
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
}

async function render(titles: Titles | null) {
  await act(async () => root.render(titles && <Section {...titles} />));
}

beforeEach(() => {
  saved = new Map(
    replacedGlobals.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  dom = new JSDOM('<!doctype html><html><head><title>Server</title></head><body></body></html>');
  setGlobal('window', dom.window);
  setGlobal('document', dom.window.document);
  setGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  root = createRoot(dom.window.document.body);
});

afterEach(async () => {
  await act(async () => root.unmount());
  dom.window.close();
  for (const [name, descriptor] of saved) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});

describe('useDocumentTitle', () => {
  it('shows the highest layer and falls back as layers go away', async () => {
    await render({ section: 'Acme › Inbox', page: 'Acme › Guide', panel: 'ACME-1 Fix' });
    assert.equal(document.title, 'ACME-1 Fix');

    await render({ section: 'Acme › Inbox', page: 'Acme › Guide' });
    assert.equal(document.title, 'Acme › Guide');

    await render({ section: 'Acme › Inbox', page: null });
    assert.equal(document.title, 'Acme › Inbox');

    await render(null);
    assert.equal(document.title, APP_NAME);
  });

  it('keeps its title when a <title> is inserted into the head later', async () => {
    await render({ section: 'Account › Profile' });
    const late = document.createElement('title');
    late.textContent = APP_NAME;
    await act(async () => {
      document.head.insertBefore(late, document.head.firstChild);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    assert.equal(document.title, 'Account › Profile');
  });

  it('follows a renamed entity without leaving the old title behind', async () => {
    await render({ section: 'Acme', page: 'Acme › Old' });
    await render({ section: 'Acme', page: 'Acme › New' });
    assert.equal(document.title, 'Acme › New');
  });

  it('settles on a title with extra whitespace', async () => {
    const NativeObserver = window.MutationObserver;
    let batches = 0;
    // Bound the broken implementation so this regression fails instead of hanging the runner.
    window.MutationObserver = class extends NativeObserver {
      constructor(callback: MutationCallback) {
        super((records, observer) => {
          if (++batches > 3) {
            observer.disconnect();
            return;
          }
          callback(records, observer);
        });
      }
    };

    await render({ section: 'Acme', page: '\t ACME-1  Fix\r\n\f next\t ' });
    await act(async () => {
      document.head.append(document.createElement('meta'));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    assert.equal(document.title, 'ACME-1 Fix next');
    assert.equal(batches, 1);
  });

  it('preserves non-breaking spaces that document.title does not trim', async () => {
    await render({ section: 'Acme', page: '\u00a0ACME-1 Fix\u00a0' });
    assert.equal(document.title, '\u00a0ACME-1 Fix\u00a0');
  });
});

describe('titlePath', () => {
  it('joins the parts, or gives null while one is missing', () => {
    assert.equal(titlePath('Acme', 'Settings', 'Labels'), 'Acme › Settings › Labels');
    assert.equal(titlePath('Acme', undefined), null);
  });
});
