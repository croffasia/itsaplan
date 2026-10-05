import type { ComponentType } from 'react';
import type { LucideIcon } from 'lucide-react';

// A section the hosted build adds to a workspace's settings: a menu entry and the page
// it opens at /workspaces/:workspaceId/:id.
export interface WorkspaceExtraSection {
  id: string;
  label: string;
  icon: LucideIcon;
  Component: ComponentType<{ workspaceId: number }>;
}
