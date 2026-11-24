import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import type { AiChatThread } from '@/lib/api/endpoints/agentChat';
import type { AiAgent } from '@/lib/api/endpoints/agents';
import { qk } from '@/services/queryKeys';
import { ChatPanelList } from './ChatPanelList';
import type { ChatSession, ChatSessions } from '../../hooks/useChatSessions';
import aiChat from '../../../../../messages/en/aiChat.json';
import common from '../../../../../messages/en/common.json';
import issue from '../../../../../messages/en/issue.json';

const replacedGlobals = [
  'window',
  'document',
  'navigator',
  'Node',
  'Element',
  'HTMLElement',
  'Event',
  'MouseEvent',
  'IntersectionObserver',
  'fetch',
  'IS_REACT_ACT_ENVIRONMENT',
] as const;

const agents = [
  { id: 1, name: 'Developer' },
  { id: 2, name: 'Writer' },
] as AiAgent[];

const now = new Date().toISOString();
const thread = (id: string, over: Partial<AiChatThread> = {}): AiChatThread => ({
  id,
  agentId: 1,
  title: `Title of ${id}`,
  cliSessionId: null,
  favorite: false,
  createdAt: now,
  updatedAt: now,
  ...over,
});
const session = (id: string, over: Partial<ChatSession> = {}): ChatSession => ({
  id,
  agentId: 1,
  threadId: null,
  title: null,
  running: false,
  hasMessages: true,
  shownAt: 0,
  ...over,
});

let dom: JSDOM;
let root: Root;
let client: QueryClient;
let opened: string[];
let picked: number;
let originals: Map<string, PropertyDescriptor | undefined>;

async function renderList(sessions: ChatSession[], threads: AiChatThread[]) {
  client.setQueryData(qk.chatThreads('eng.RUN'), {
    pages: [{ items: threads, nextPage: null }],
    pageParams: [0],
  });
  client.setQueryData(qk.favoriteChatThreads('eng.RUN'), {
    items: [thread('starred', { favorite: true, agentId: 2 })],
    nextPage: null,
  });
  const chats = {
    sessions,
    active: sessions[0] ?? null,
    show: (id: string) => opened.push(`session ${id}`),
    openThread: (one: AiChatThread) => opened.push(`thread ${one.id}`),
  } as unknown as ChatSessions;
  await act(async () =>
    root.render(
      <QueryClientProvider client={client}>
        <NextIntlClientProvider locale="en" timeZone="UTC" messages={{ aiChat, common, issue }}>
          <ChatPanelList
            projectKey="eng.RUN"
            agents={agents}
            chats={chats}
            onPicked={() => (picked += 1)}
          />
        </NextIntlClientProvider>
      </QueryClientProvider>,
    ),
  );
}

// The list as it reads: each heading with the conversations under it.
const groups = () =>
  [...document.querySelectorAll('section')].map((section) => [
    section.querySelector('h3')!.textContent,
    [...section.querySelectorAll('button[aria-current] > span:nth-child(2)')].map(
      (title) => title.textContent,
    ),
  ]);

beforeEach(async () => {
  originals = new Map(
    replacedGlobals.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]),
  );
  opened = [];
  picked = 0;
  dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://localhost' });
  for (const name of replacedGlobals) {
    if (name in dom.window)
      Object.defineProperty(globalThis, name, {
        configurable: true,
        value: dom.window[name as keyof typeof dom.window],
      });
  }
  Object.defineProperties(globalThis, {
    IntersectionObserver: {
      configurable: true,
      value: class {
        observe() {}
        disconnect() {}
      },
    },
    fetch: { configurable: true, value: async () => Response.json({ items: [], nextPage: null }) },
    IS_REACT_ACT_ENVIRONMENT: { configurable: true, value: true },
  });
  client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
  const { createRoot } = await import('react-dom/client');
  root = createRoot(document.getElementById('root')!);
});

afterEach(async () => {
  await act(async () => root.unmount());
  client.clear();
  dom.window.close();
  for (const [name, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});

describe('ChatPanelList', () => {
  it('lists each conversation once, the answering ones first', async () => {
    await renderList(
      [session('s1', { running: true, threadId: 'busy' }), session('s2')],
      [thread('busy'), thread('recent'), thread('old', { updatedAt: '2020-01-01T00:00:00Z' })],
    );
    assert.deepEqual(groups(), [
      [issue.agentRuns.activeSection, ['Title of busy']],
      [aiChat.favorites, ['Title of starred']],
      // One with an agent that keeps no memory is only held here.
      [aiChat.today, [aiChat.newChat, 'Title of recent']],
      [aiChat.earlier, ['Title of old']],
    ]);
  });

  it('names the agent of a conversation, and says when it is answering', async () => {
    await renderList([session('s1', { running: true })], [thread('recent', { agentId: 2 })]);
    const text = document.body.textContent!;
    assert.ok(text.includes(`Developer · ${issue.agentRuns.running}`));
    assert.ok(text.includes('Title of recent'));
    assert.ok(text.includes('Writer'));
  });

  it('opens what is picked', async () => {
    await renderList([session('s1', { running: true })], [thread('recent')]);
    const rows = [...document.querySelectorAll<HTMLElement>('button[aria-current]')];
    const row = (title: string) => rows.find((one) => one.textContent!.includes(title))!;
    await act(async () => row(aiChat.newChat).click());
    await act(async () => row('Title of recent').click());
    assert.deepEqual(opened, ['session s1', 'thread recent']);
    assert.equal(picked, 2);
  });
});
