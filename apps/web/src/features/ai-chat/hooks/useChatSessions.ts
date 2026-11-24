'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AiChatThread } from '@/lib/api/endpoints/agentChat';
import { forgetStoredChat, readStoredChat, writeStoredChat } from '@/utils/storedChat';
import { uuid } from '@/utils/uuid';

// One conversation the chat holds. `threadId` is null until the first message starts one,
// and stays null for an agent that keeps no memory. `title` is what the history called the
// conversation when it was opened from there. `running` and `hasMessages` are what the
// session's transcript reports back, so the chat knows what is going on in a session it is
// not showing.
export type ChatSession = {
  id: string;
  agentId: number;
  threadId: string | null;
  title: string | null;
  running: boolean;
  hasMessages: boolean;
  shownAt: number;
};

export type ChatSessionState = Pick<ChatSession, 'running' | 'hasMessages'>;

export type ChatSessions = ReturnType<typeof useChatSessions>;

type Chats = { sessions: ChatSession[]; activeId: string | null };

const NONE: Chats = { sessions: [], activeId: null };

// How many saved conversations stay mounted besides the ones that are answering.
const KEPT = 6;

const newSession = (
  agentId: number,
  threadId: string | null = null,
  title: string | null = null,
): ChatSession => ({
  id: uuid(),
  agentId,
  threadId,
  title,
  running: false,
  hasMessages: threadId !== null,
  shownAt: Date.now(),
});

const isBlank = (session: ChatSession) => !session.threadId && !session.hasMessages;

const activeOf = ({ sessions, activeId }: Chats) =>
  sessions.find((session) => session.id === activeId) ?? sessions.at(-1) ?? null;

const withChange = (chats: Chats, id: string, change: Partial<ChatSession>): Chats => ({
  ...chats,
  sessions: chats.sessions.map((session) =>
    session.id === id ? { ...session, ...change } : session,
  ),
});

const withShown = (chats: Chats, id: string): Chats => ({
  ...withChange(chats, id, { shownAt: Date.now() }),
  activeId: id,
});

// A saved conversation that is not answering is read again when it is opened, so the ones
// shown longest ago make room.
function withSession({ sessions }: Chats, session: ChatSession): Chats {
  const idle = sessions
    .filter((other) => other.threadId && !other.running)
    .sort((a, b) => a.shownAt - b.shownAt);
  const dropped = new Set(idle.slice(0, Math.max(0, idle.length - KEPT + 1)));
  return {
    sessions: [...sessions.filter((other) => !dropped.has(other)), session],
    activeId: session.id,
  };
}

// A chat nothing was said in is the new chat, whichever agent it was with.
function withNewChat(chats: Chats, agentId: number): Chats {
  const blank = chats.sessions.find(isBlank);
  if (!blank) return withSession(chats, newSession(agentId));
  return withShown(withChange(chats, blank.id, { agentId }), blank.id);
}

function readChats(projectKey: string): Chats {
  const stored = readStoredChat(projectKey);
  if (!stored) return NONE;
  const session = newSession(stored.agentId, stored.threadId, stored.title);
  return { sessions: [session], activeId: session.id };
}

// The sessions of the chat in one project, one of them shown. A session stays mounted
// behind the shown one, so it keeps its transcript and its composer and continues to
// receive its reply. The chat always holds at least one, and the conversation shown last is
// kept on the device, so a reload opens it.
//
// `agentIds` are the agents a new chat may start with.
export function useChatSessions(projectKey: string, agentIds: number[]) {
  const [held, setChats] = useState(NONE);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  // The chat outlives the route: until a move to a different project has loaded that
  // project's chats, the ones held are not its own.
  const loaded = loadedKey === projectKey;
  const chats = loaded ? held : NONE;
  const { sessions } = chats;
  const active = activeOf(chats);
  const firstAgentId = agentIds[0] ?? null;

  // Storage is read here rather than in the state initializer: this component also
  // renders on the server, where there is none.
  useEffect(() => {
    setChats(readChats(projectKey));
    setLoadedKey(projectKey);
  }, [projectKey]);

  // Only once this project's chat has been read: a fresh one made before that would take
  // the place of the kept one.
  useEffect(() => {
    if (firstAgentId == null || !loaded || sessions.length > 0) return;
    setChats((prev) => withNewChat(prev, firstAgentId));
  }, [firstAgentId, loaded, sessions.length]);

  // A chat that has not started has nothing to be restored from, so the conversation
  // before it stays the kept one.
  useEffect(() => {
    if (!active?.threadId) return;
    const { agentId, threadId, title } = active;
    writeStoredChat(projectKey, { agentId, threadId, title });
  }, [projectKey, active]);

  // A new chat starts with the agent asked for, or else the one of the shown chat, where
  // that one may be picked.
  const started = (prev: Chats, asked = activeOf(prev)?.agentId): Chats => {
    const picked = asked != null && agentIds.includes(asked) ? asked : firstAgentId;
    return picked == null ? prev : withNewChat(prev, picked);
  };

  return {
    sessions,
    active,
    show: (id: string) => setChats((prev) => withShown(prev, id)),
    newChat: (asked?: number) => setChats((prev) => started(prev, asked)),
    // Opens a past conversation: one that is held already is shown as it is.
    openThread: (thread: AiChatThread) =>
      setChats((prev) => {
        const open = prev.sessions.find((session) => session.threadId === thread.id);
        return open
          ? withShown(prev, open.id)
          : withSession(prev, newSession(thread.agentId, thread.id, thread.title));
      }),
    // Drops a conversation that was deleted. A new chat with its agent stands in for the
    // one that was shown.
    dropThread: (id: string) => {
      forgetStoredChat(projectKey, id);
      setChats((prev) => {
        const dropped = prev.sessions.find((session) => session.threadId === id);
        if (!dropped) return prev;
        const rest = { ...prev, sessions: prev.sessions.filter((one) => one !== dropped) };
        return dropped === activeOf(prev) ? started(rest, dropped.agentId) : rest;
      });
    },
    // A chat that has said nothing changes its agent in place; one with a transcript keeps
    // it, and the other agent is talked to in a new chat.
    pickAgent: (session: ChatSession, picked: number) => {
      if (picked === session.agentId) return;
      setChats((prev) =>
        session.hasMessages
          ? started(prev, picked)
          : withChange(prev, session.id, { agentId: picked }),
      );
    },
    setThread: useCallback(
      (id: string, created: string) =>
        setChats((prev) => withChange(prev, id, { threadId: created })),
      [],
    ),
    // A session reports its state on every render of its transcript. Keeping the state as it
    // is when nothing changed is what stops that from re-rendering the chat.
    setState: useCallback((id: string, { running, hasMessages }: ChatSessionState) => {
      setChats((prev) => {
        const session = prev.sessions.find((one) => one.id === id);
        if (!session) return prev;
        if (session.running === running && session.hasMessages === hasMessages) return prev;
        return withChange(prev, id, { running, hasMessages });
      });
    }, []),
  };
}
