import type { ComponentType } from 'react';
import type { LucideIcon } from 'lucide-react';

// An entry in a workspace's settings menu, opened at workspacePath(workspaceId, id). The
// core's entries have routes of their own; one the hosted build adds carries its page in
// `Component`.
export interface WorkspaceSection {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
  Component?: ComponentType<{ workspaceId: number }>;
}
