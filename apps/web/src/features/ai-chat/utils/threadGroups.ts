import type { AiChatThread } from '@/lib/api/endpoints/agentChat';
import { dayKey } from '@/utils/dates';

// The history under its headings: the conversations of today and the ones before. One that
// is answering stands in a group of its own over them, so it is left out here.
export function threadGroups(
  threads: AiChatThread[],
  answering: ReadonlySet<string>,
  now = new Date(),
): { today: AiChatThread[]; earlier: AiChatThread[] } {
  const today = dayKey(now.toISOString());
  const rest = threads.filter((thread) => !answering.has(thread.id));
  return {
    today: rest.filter((thread) => dayKey(thread.updatedAt) === today),
    earlier: rest.filter((thread) => dayKey(thread.updatedAt) !== today),
  };
}
