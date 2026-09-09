'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { PermissionAction, Permissions } from '@/lib/api/endpoints/roles';

// The team whose agents the section edits, and what the caller may do with them.
// Provided once by the section so the parts of the agent editor read both instead of
// threading them through every component.
type AgentSection = { teamId: number; permissions: Permissions['ai_agents'] };

const AgentSectionContext = createContext<AgentSection | null>(null);

export function AgentSectionProvider({
  teamId,
  permissions,
  children,
}: AgentSection & { children: ReactNode }) {
  return (
    <AgentSectionContext.Provider value={{ teamId, permissions }}>
      {children}
    </AgentSectionContext.Provider>
  );
}

export function useAgentSection(): AgentSection {
  const value = useContext(AgentSectionContext);
  if (!value) throw new Error('useAgentSection outside AgentSectionProvider');
  return value;
}

// Whether the caller may perform the action on the team's agents. Gates UI only — the
// API enforces the same matrix on every request.
export function useAgentCan(): (action: PermissionAction) => boolean {
  const { permissions } = useAgentSection();
  return (action) => permissions[action];
}
