import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import type { AiChatThread } from '@/lib/api/endpoints/agentChat';
import { useChatSessions, type ChatSessions } from './useChatSessions';

const replacedGlobals = ['window', 'document', 'localStorage', 'IS_REACT_ACT_ENVIRONMENT'] as const;

let dom: JSDOM;
let root: Root;
let originals: Map<string, PropertyDescriptor | undefined>;
let chats: ChatSessions;

let rendered: (string | null | undefined)[];

function Probe({ projectKey, agentIds }: { projectKey: string; agentIds: number[] }) {
  chats = useChatSessions(projectKey, agentIds);
  rendered.push(chats.active?.threadId);
  return null;
}

const render = (agentIds = [1, 2], projectKey = 'eng.RUN') =>
  act(async () => root.render(<Probe projectKey={projectKey} agentIds={agentIds} />));

async function reload() {
  await act(async () => root.render(null));
  await render();
}

const run = (change: () => void) => act(async () => change());

const thread = (id: string, agentId = 1) =>
  ({ id, agentId, title: `Title of ${id}` }) as AiChatThread;

const shown = () => [chats.active?.agentId, chats.active?.threadId];

beforeEach(async () => {
  rendered = [];
  originals = new Map(
    replacedGlobals.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost' });
  Object.defineProperties(globalThis, {
    window: { configurable: true, value: dom.window },
    document: { configurable: true, value: dom.window.document },
    localStorage: { configurable: true, value: dom.window.localStorage },
    IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true },
  });
  const { createRoot } = await import('react-dom/client');
  root = createRoot(document.getElementById('root')!);
});

afterEach(async () => {
  await act(async () => root.unmount());
  dom.window.close();
  for (const [name, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});

describe('useChatSessions', () => {
  it('starts with a new chat with the first agent', async () => {
    await render();
    assert.deepEqual(shown(), [1, null]);
  });

  it('shows a conversation it holds already instead of opening it twice', async () => {
    await render();
    await run(() => chats.openThread(thread('a')));
    const first = chats.active!.id;
    await run(() => chats.openThread(thread('b', 2)));
    assert.deepEqual(shown(), [2, 'b']);
    await run(() => chats.openThread(thread('a')));
    assert.equal(chats.active!.id, first);
    assert.equal(chats.sessions.length, 3);
  });

  it('has one new chat at a time, with the agent of the shown one', async () => {
    await render();
    const blank = chats.active!.id;
    await run(() => chats.openThread(thread('b', 2)));
    await run(() => chats.newChat());
    assert.equal(chats.active!.id, blank);
    assert.deepEqual(shown(), [2, null]);
  });

  it('starts a new chat with an offered agent where the shown one is not', async () => {
    await render();
    await run(() => chats.openThread(thread('old', 9)));
    await run(() => chats.newChat());
    assert.deepEqual(shown(), [1, null]);
  });

  it('changes the agent in place until something was said', async () => {
    await render();
    const first = chats.active!.id;
    await run(() => chats.pickAgent(chats.active!, 2));
    assert.deepEqual([chats.active!.id, chats.active!.agentId], [first, 2]);

    await run(() => chats.setState(first, { running: true, hasMessages: true }));
    await run(() => chats.pickAgent(chats.active!, 1));
    assert.notEqual(chats.active!.id, first);
    assert.deepEqual(shown(), [1, null]);
    assert.equal(chats.sessions.find((session) => session.id === first)!.running, true);
  });

  it('puts a new chat with the same agent in place of a deleted one', async () => {
    await render();
    await run(() => chats.openThread(thread('b', 2)));
    await run(() => chats.dropThread('b'));
    assert.deepEqual(shown(), [2, null]);
    assert.ok(!chats.sessions.some((session) => session.threadId === 'b'));
  });

  it('keeps the shown one when another is deleted', async () => {
    await render();
    await run(() => chats.openThread(thread('a')));
    await run(() => chats.openThread(thread('b')));
    await run(() => chats.dropThread('a'));
    assert.deepEqual(shown(), [1, 'b']);
  });

  it('keeps what changed in the others while one was being deleted', async () => {
    await render();
    const other = chats.active!.id;
    await run(() => chats.openThread(thread('b', 2)));
    const { dropThread } = chats;
    await run(() => chats.setThread(other, 'started'));
    await run(() => dropThread('b'));
    assert.ok(chats.sessions.some((session) => session.threadId === 'started'));
  });

  it('opens the conversation shown last after a reload, a new chat after it or not', async () => {
    await render();
    await run(() => chats.openThread(thread('a')));
    await run(() => chats.openThread(thread('b', 2)));
    await reload();
    assert.deepEqual(shown(), [2, 'b']);
    assert.equal(chats.active!.title, 'Title of b');

    await run(() => chats.newChat());
    await reload();
    assert.deepEqual(shown(), [2, 'b']);
  });

  it('holds none of the chats of the project it was in before', async () => {
    await render();
    await run(() => chats.openThread(thread('a')));
    await render([3], 'eng.WEB');
    await run(() => chats.openThread(thread('b', 3)));
    rendered = [];
    await render();
    assert.deepEqual(rendered, [undefined, 'a']);
  });

  it('does not open a deleted conversation after a reload', async () => {
    await render();
    await run(() => chats.openThread(thread('b', 2)));
    await run(() => chats.dropThread('b'));
    await reload();
    assert.deepEqual(shown(), [1, null]);
  });

  it('opens the tab that was in front on a device that still holds tabs', async () => {
    const tabs = [
      { id: 'x', agentId: 1, threadId: 'a' },
      { id: 'y', agentId: 2, threadId: 'b' },
    ];
    const key = 'aiChat:panel:tabs:eng.RUN';
    localStorage.setItem(key, JSON.stringify({ sessions: tabs, activeId: 'y' }));
    await render();
    assert.deepEqual(shown(), [2, 'b']);
    assert.equal(localStorage.getItem(key), null);
    await reload();
    assert.deepEqual(shown(), [2, 'b']);
  });

  it('starts a new chat where what the device holds cannot be read', async () => {
    localStorage.setItem('aiChat:panel:chat:eng.RUN', '{"agentId":"x"}');
    await render();
    assert.deepEqual(shown(), [1, null]);
  });

  it('lets go of the conversations shown longest ago, never of one that is answering', async () => {
    let now = 0;
    mock.method(Date, 'now', () => (now += 1));
    await render();
    await run(() => chats.openThread(thread('busy')));
    await run(() => chats.setState(chats.active!.id, { running: true, hasMessages: true }));
    for (let i = 0; i < 6; i++) await run(() => chats.openThread(thread(`t${i}`)));
    await run(() => chats.openThread(thread('t0')));
    await run(() => chats.openThread(thread('t6')));
    mock.restoreAll();

    const held = chats.sessions.map((session) => session.threadId);
    assert.deepEqual(held, [null, 'busy', 't0', 't2', 't3', 't4', 't5', 't6']);
  });
});
