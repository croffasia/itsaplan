'use client';

import { useContext } from 'react';
import { ShellCtx } from '@/context/shellContext';
import { useAgentDirectoryQuery, useAiAgentsQuery } from '@/services/aiAgents.service';

// The agents working in the open project. An agent belongs to a team and reaches the
// projects it is attached to, so the list is read from that team and narrowed to this
// project — the screens inside a project (its chat panel, its schedules, its read-only
// agent list) all want exactly those.
export function useProjectAgents(enabled = true) {
  const project = useContext(ShellCtx)?.project?.project ?? null;
  return useAiAgentsQuery(enabled ? (project?.teamId ?? null) : null, project?.id);
}

// The agents of the open project by name, kind and model, for a screen that only picks or
// names one. Any member reads it, without the `ai_agents` permission useProjectAgents needs.
export function useAgentDirectory() {
  return useAgentDirectoryQuery(useContext(ShellCtx)?.project?.project ?? null);
}
