'use client';

import { useCallback, useEffect, useState } from 'react';

// One open conversation in the chat panel. `threadId` is null until the agent answers
// the first message. `running` is what the session's transcript reports back, so the
// panel knows a reply is being produced in a session it is not showing.
export type ChatSession = {
  id: string;
  agentId: number;
  threadId: string | null;
  running: boolean;
};

const newSession = (agentId: number, threadId: string | null = null): ChatSession => ({
  id: crypto.randomUUID(),
  agentId,
  threadId,
  running: false,
});

// The sessions the chat panel holds open, for one project. Every session stays mounted
// while it is open, so a session that is not shown keeps its transcript and its composer
// and continues to receive its reply.
//
// The panel always holds at least one session: closing the last one leaves a fresh chat
// in its place.
export function useChatSessions(projectKey: string | null, defaultAgentId: number | null) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  // The panel outlives the route, so a move to a different project starts over.
  useEffect(() => {
    setSessions([]);
    setActiveId(null);
  }, [projectKey]);

  useEffect(() => {
    if (defaultAgentId == null || sessions.length > 0) return;
    const first = newSession(defaultAgentId);
    setSessions([first]);
    setActiveId(first.id);
  }, [defaultAgentId, sessions.length]);

  const update = useCallback((id: string, change: Partial<ChatSession>) => {
    setSessions((prev) =>
      prev.map((session) => (session.id === id ? { ...session, ...change } : session)),
    );
  }, []);

  // Opens a thread as a session: a thread that is already open is brought forward
  // instead of opening a second session for it.
  const openSession = useCallback(
    (agentId: number, threadId: string | null = null) => {
      const existing = threadId
        ? sessions.find((session) => session.threadId === threadId)
        : undefined;
      if (existing) {
        setActiveId(existing.id);
        return;
      }
      const session = newSession(agentId, threadId);
      setSessions((prev) => [...prev, session]);
      setActiveId(session.id);
    },
    [sessions],
  );

  // The session next to the closed one takes over. Closing the last session leaves an
  // empty chat with the agent that session used.
  const closeSession = useCallback(
    (id: string) => {
      const index = sessions.findIndex((session) => session.id === id);
      if (index < 0) return;
      const rest = sessions.filter((session) => session.id !== id);
      if (rest.length === 0) {
        const fresh = newSession(sessions[index].agentId);
        setSessions([fresh]);
        setActiveId(fresh.id);
        return;
      }
      setSessions(rest);
      if (activeId === id) setActiveId((rest[index] ?? rest[rest.length - 1]).id);
    },
    [sessions, activeId],
  );

  const active = sessions.find((session) => session.id === activeId) ?? sessions[0] ?? null;

  return {
    sessions,
    active,
    setActive: setActiveId,
    openSession,
    closeSession,
    setThread: useCallback((id: string, threadId: string) => update(id, { threadId }), [update]),
    setAgent: useCallback((id: string, agentId: number) => update(id, { agentId }), [update]),
    // A session reports its state on every render of its transcript. Keeping the array
    // as it is when nothing changed is what stops that from re-rendering the panel.
    setRunning: useCallback((id: string, running: boolean) => {
      setSessions((prev) =>
        prev.some((session) => session.id === id && session.running !== running)
          ? prev.map((session) => (session.id === id ? { ...session, running } : session))
          : prev,
      );
    }, []),
  };
}
