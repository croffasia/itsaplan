import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { NextIntlClientProvider } from 'next-intl';
import common from '../../messages/en/common.json';
import { useAgentChat } from './useAgentChat';

const replacedGlobals = ['window', 'document', 'fetch', 'IS_REACT_ACT_ENVIRONMENT'] as const;

let dom: JSDOM;
let root: Root;
let originals: Map<string, PropertyDescriptor | undefined>;
let chat: ReturnType<typeof useAgentChat>;
let endStream: () => void;

function Probe({ external }: { external: boolean }) {
  chat = useAgentChat('eng.RUN', 1, external);
  return null;
}

// Stays open after its frames, as an answer that is still being written does.
function openStream(frames: string[]) {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const frame of frames) {
        controller.enqueue(new TextEncoder().encode(`data: ${frame}\n\n`));
      }
      endStream = () => controller.close();
    },
  });
  return new Response(body);
}

async function send(external: boolean) {
  await act(async () =>
    root.render(
      <NextIntlClientProvider locale="en" timeZone="UTC" messages={{ common }}>
        <Probe external={external} />
      </NextIntlClientProvider>,
    ),
  );
  await act(async () => {
    chat.send('Plan the launch');
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

beforeEach(async () => {
  originals = new Map(
    replacedGlobals.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost' });
  Object.defineProperties(globalThis, {
    window: { configurable: true, value: dom.window },
    document: { configurable: true, value: dom.window.document },
    fetch: {
      configurable: true,
      value: async (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input).endsWith('/run/stream'))
          return openStream([JSON.stringify({ type: 'thread', threadId: 'inside' })]);
        if (init?.method === 'POST') return Response.json({ threadId: 'outside', messageId: 5 });
        return openStream([]);
      },
    },
    IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true },
  });
  const { createRoot } = await import('react-dom/client');
  root = createRoot(document.getElementById('root')!);
});

afterEach(async () => {
  await act(async () => {
    endStream();
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
  await act(async () => root.unmount());
  dom.window.close();
  for (const [name, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});

describe('useAgentChat', () => {
  it('knows the conversation while the first answer is still being written', async () => {
    await send(false);
    assert.deepEqual([chat.threadId, chat.status], ['inside', 'streaming']);
  });

  it('knows the conversation of an external agent before a runner takes the message', async () => {
    await send(true);
    assert.deepEqual([chat.threadId, chat.status], ['outside', 'queued']);
  });
});
