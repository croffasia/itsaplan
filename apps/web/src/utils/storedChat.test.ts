import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { JSDOM } from 'jsdom';
import { clearStoredChats, readStoredChat, writeStoredChat } from './storedChat';

let dom: JSDOM;
let original: PropertyDescriptor | undefined;

beforeEach(() => {
  original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  dom = new JSDOM('', { url: 'http://localhost' });
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: dom.window.localStorage,
  });
});

afterEach(() => {
  dom.window.close();
  if (original) Object.defineProperty(globalThis, 'localStorage', original);
  else Reflect.deleteProperty(globalThis, 'localStorage');
});

describe('storedChat', () => {
  it('drops the chats and the tabs of every project, and nothing else', () => {
    writeStoredChat('eng.RUN', { agentId: 1, threadId: 'a', title: 'Launch' });
    writeStoredChat('eng.WEB', { agentId: 1, threadId: 'b', title: null });
    localStorage.setItem('aiChat:panel:tabs:eng.OPS', '{}');
    localStorage.setItem('aiChat:panel:open:eng.RUN', 'open');
    assert.equal(readStoredChat('eng.RUN')?.title, 'Launch');

    clearStoredChats();
    assert.deepEqual(Object.keys(localStorage), ['aiChat:panel:open:eng.RUN']);
  });
});
