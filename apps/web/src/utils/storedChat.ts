// The conversation the chat showed last in a project, kept in this browser so that a reload
// opens it. Signing out drops it.

export type StoredChat = { agentId: number; threadId: string; title: string | null };

const PREFIX = 'aiChat:panel:chat:';
// Where the chat kept its tabs while it had them.
const TABS_PREFIX = 'aiChat:panel:tabs:';

function isStored(value: unknown): value is StoredChat {
  if (typeof value !== 'object' || value === null) return false;
  const chat = value as StoredChat;
  return (
    typeof chat.agentId === 'number' &&
    typeof chat.threadId === 'string' &&
    (typeof chat.title === 'string' || chat.title == null)
  );
}

function readKey(key: string): unknown {
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) : null;
}

// The tab that was in front, where this device still holds tabs.
function readTab(projectKey: string): unknown {
  const tabs = readKey(TABS_PREFIX + projectKey) as {
    sessions?: { id?: unknown }[];
    activeId?: unknown;
  } | null;
  const sessions = tabs?.sessions ?? [];
  return sessions.find((session) => session.id === tabs?.activeId) ?? sessions[0];
}

export function readStoredChat(projectKey: string): StoredChat | null {
  try {
    const stored = readKey(PREFIX + projectKey) ?? readTab(projectKey);
    return isStored(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function writeStoredChat(projectKey: string, chat: StoredChat) {
  try {
    localStorage.setItem(PREFIX + projectKey, JSON.stringify(chat));
    localStorage.removeItem(TABS_PREFIX + projectKey);
  } catch {
    // Storage unavailable (private mode / quota); the chat still works on this page.
  }
}

export function forgetStoredChat(projectKey: string, threadId: string) {
  if (readStoredChat(projectKey)?.threadId !== threadId) return;
  try {
    localStorage.removeItem(PREFIX + projectKey);
    localStorage.removeItem(TABS_PREFIX + projectKey);
  } catch {
    // Storage unavailable: there is nothing to forget.
  }
}

export function clearStoredChats() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(PREFIX) || key.startsWith(TABS_PREFIX)) localStorage.removeItem(key);
    }
  } catch {
    // Storage unavailable: there is nothing stored to clear.
  }
}
