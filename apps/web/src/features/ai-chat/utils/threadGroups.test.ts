import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AiChatThread } from '@/lib/api/endpoints/agentChat';
import { threadGroups } from './threadGroups';

const thread = (id: string, updatedAt: string) => ({ id, updatedAt }) as AiChatThread;
const ids = (threads: AiChatThread[]) => threads.map(({ id }) => id);

describe('threadGroups', () => {
  const now = new Date('2026-11-24T12:00:00Z');
  const threads = [
    thread('now', '2026-11-24T11:59:00Z'),
    thread('answering', '2026-11-24T11:00:00Z'),
    thread('yesterday', '2026-11-23T12:00:00Z'),
    thread('older', '2026-10-01T12:00:00Z'),
  ];

  it('parts the conversations of today from the ones before', () => {
    const { today, earlier } = threadGroups(threads, new Set(), now);
    assert.deepEqual(ids(today), ['now', 'answering']);
    assert.deepEqual(ids(earlier), ['yesterday', 'older']);
  });

  it('leaves out the ones that are answering', () => {
    const { today } = threadGroups(threads, new Set(['answering']), now);
    assert.deepEqual(ids(today), ['now']);
  });
});
