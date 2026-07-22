import { createContext, useContext } from 'react';
import type { CustomField, IssueOpenMode, ProjectDetail, View } from '@/lib/api';
import type { NewIssueDefaults } from '@/utils/project';
import type { useViewEditor } from '@/hooks/useViewEditor';

// What the Shell layout provides to its child pages (the work items view and the
// settings pages) through React context. The Shell owns the project data, the
// view editor and the project-level overlays; children read them here instead of
// re-querying.
export type ShellContext = {
  project: ProjectDetail | null;
  filteredProject: ProjectDetail | null;
  views: View[];
  editor: ReturnType<typeof useViewEditor>;
  customFields: CustomField[];
  // Opens an issue. Without `mode` the account's issueOpenMode preference decides
  // between the side panel and the issue page; pass it to force one of them.
  onOpenIssue: (id: number, mode?: IssueOpenMode) => void;
  onAddIssue: (defaults: NewIssueDefaults) => void;
};

export const ShellCtx = createContext<ShellContext | null>(null);

export function useShell(): ShellContext {
  const ctx = useContext(ShellCtx);
  if (!ctx) throw new Error('useShell must be used within the project Shell');
  return ctx;
}
