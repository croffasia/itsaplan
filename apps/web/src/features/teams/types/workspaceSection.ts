import type { ComponentType } from 'react';
import type { LucideIcon } from 'lucide-react';

export const WORKSPACE_SECTION_GROUPS = ['overview', 'settings', 'history'] as const;

export type WorkspaceSectionGroup = (typeof WORKSPACE_SECTION_GROUPS)[number];

// An entry in a workspace's settings menu, opened at workspacePath(workspaceId, id). The
// core's entries have routes of their own; one the hosted build adds carries its page in
// `Component`. The menu lists what the workspace shows, then what is set in it, then its
// history.
export interface WorkspaceSection {
  id: string;
  label: string;
  icon: LucideIcon;
  group: WorkspaceSectionGroup;
  badge?: string;
  Component?: ComponentType<{ workspaceId: number }>;
}
