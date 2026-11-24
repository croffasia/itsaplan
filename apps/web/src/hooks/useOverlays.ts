import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { Issue } from '@/lib/api/endpoints/issues';
import type { NewIssueDefaults } from '@/utils/project';

// The project-level overlays, grouped here so the Shell tracks one object instead of
// a flag each, and so the keyboard shortcut layer can ask whether any of them is open
// through `anyOpen`. Project settings are their own pages, not an overlay.
export function useOverlays() {
  const [showNewProject, setShowNewProject] = useState(false);
  const [showNewInitiative, setShowNewInitiative] = useState(false);
  const [showCommand, setShowCommand] = useState(false);
  // The new-issue modal's initial field values and what runs once the issue exists
  // (null = the modal is closed).
  const [newIssue, setNewIssue] = useState<{
    defaults: NewIssueDefaults;
    onCreated?: (created: Issue) => void;
  } | null>(null);
  // Which issue the detail panel shows (null = the panel is closed).
  const [openIssueId, setOpenIssueId] = useState<number | null>(null);

  // The panel is not addressed by the URL, so a link inside it navigates the page
  // behind it and leaves the panel standing over the new page.
  const pathname = usePathname();
  useEffect(() => {
    setOpenIssueId(null);
  }, [pathname]);

  const anyOpen =
    showNewProject || showNewInitiative || showCommand || newIssue != null || openIssueId != null;

  return {
    showNewProject,
    setShowNewProject,
    showNewInitiative,
    setShowNewInitiative,
    showCommand,
    setShowCommand,
    newIssue,
    setNewIssue,
    openIssueId,
    setOpenIssueId,
    anyOpen,
  };
}
