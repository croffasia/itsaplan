import type { Locale } from '@/i18n/locales';
import type { MessageTree } from '@/i18n/messages';

// The messages the hosted build adds: `cloudMessages` is its English, merged into the
// catalogue the keys are typed against, and `loadCloudMessages` returns the same keys in
// another language. A self-hosted instance adds none.
export const cloudMessages = {};

export async function loadCloudMessages(_locale: Locale): Promise<MessageTree> {
  return {};
}
