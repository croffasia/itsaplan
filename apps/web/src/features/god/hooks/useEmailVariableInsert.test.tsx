import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act, useState } from 'react';
import type { Root } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import type { EmailText } from '@/lib/api/endpoints/god';

let dom: JSDOM;
let root: Root;
let text: EmailText;
let fields: ReturnType<typeof import('./useEmailVariableInsert').useEmailVariableInsert>;
const replaced = [
  'window',
  'document',
  'requestAnimationFrame',
  'IS_REACT_ACT_ENVIRONMENT',
] as const;
let originals: Map<string, PropertyDescriptor | undefined>;

async function mount(withButton: boolean) {
  const { useEmailVariableInsert } = await import('./useEmailVariableInsert');
  function Probe() {
    const [current, setCurrent] = useState<EmailText>({
      subject: 'Hello',
      body: 'Body',
      button: 'Open',
    });
    text = current;
    fields = useEmailVariableInsert(current, (patch) => setCurrent({ ...current, ...patch }));
    return (
      <>
        <input ref={fields.subject} defaultValue="Hello" />
        <textarea ref={fields.body} defaultValue="Body" />
        {withButton && <input ref={fields.button} defaultValue="Open" />}
      </>
    );
  }
  await act(async () => root.render(<Probe />));
}

beforeEach(async () => {
  originals = new Map(replaced.map((n) => [n, Object.getOwnPropertyDescriptor(globalThis, n)]));
  dom = new JSDOM('<!doctype html><div id="root"></div>');
  Object.defineProperties(globalThis, {
    window: { configurable: true, value: dom.window },
    document: { configurable: true, value: dom.window.document },
    requestAnimationFrame: { configurable: true, value: () => 0 },
    IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true },
  });
  const { createRoot } = await import('react-dom/client');
  root = createRoot(dom.window.document.querySelector('#root')!);
});

afterEach(async () => {
  await act(async () => root.unmount());
  dom.window.close();
  for (const [name, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});

describe('useEmailVariableInsert', () => {
  it('puts a variable in the text by default', async () => {
    await mount(true);
    fields.body.current!.setSelectionRange(4, 4);

    await act(async () => fields.insert('ref'));

    assert.equal(text.body, 'Body{ref}');
    assert.equal(text.subject, 'Hello');
  });

  it('puts a variable at the cursor of the field last in focus', async () => {
    await mount(true);
    fields.subject.current!.setSelectionRange(0, 5);
    fields.track('subject');

    await act(async () => fields.insert('ref'));

    assert.equal(text.subject, '{ref}');
    assert.equal(text.body, 'Body');
  });

  it('puts a variable in the text when the focused field is gone', async () => {
    await mount(false);
    fields.body.current!.setSelectionRange(0, 0);
    fields.track('button');

    await act(async () => fields.insert('ref'));

    assert.equal(text.body, '{ref}Body');
    assert.equal(text.button, 'Open');
  });
});
