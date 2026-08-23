import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { NewIssueDefaults } from '@/utils/project';

// The project-level overlays: the new-project modal, the command palette, the
// new-issue modal and the issue detail panel. Grouped here so the Shell tracks
// one object instead of four flags, and so the keyboard shortcut layer can ask
// whether any overlay is open through `anyOpen`. Project settings are their own
// pages, not an overlay.
export function useOverlays() {
  const [showNewProject, setShowNewProject] = useState(false);
  const [showCommand, setShowCommand] = useState(false);
  // Initial field values for a new issue (null = the new-issue modal is closed).
  const [newIssueDefaults, setNewIssueDefaults] = useState<NewIssueDefaults | null>(null);
  // Which issue the detail panel shows (null = the panel is closed).
  const [openIssueId, setOpenIssueId] = useState<number | null>(null);

  // The panel is not addressed by the URL, so a link inside it navigates the page
  // behind it and leaves the panel standing over the new page.
  const pathname = usePathname();
  useEffect(() => {
    setOpenIssueId(null);
  }, [pathname]);

  const anyOpen = showNewProject || showCommand || newIssueDefaults != null || openIssueId != null;

  return {
    showNewProject,
    setShowNewProject,
    showCommand,
    setShowCommand,
    newIssueDefaults,
    setNewIssueDefaults,
    openIssueId,
    setOpenIssueId,
    anyOpen,
  };
}
