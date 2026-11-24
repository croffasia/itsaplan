import { useContext, useState, type ReactNode } from 'react';
import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import type { Issue } from '@/lib/api/endpoints/issues';
import { IssueOpenerCtx } from '@/context/shellContext';
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu';
import IssueMenu from './IssueMenu';

export default function IssueContextMenu({
  project,
  issue,
  onDeleted,
  children,
}: {
  project: ProjectDetail;
  issue: Issue;
  onDeleted?: () => void;
  children: ReactNode;
}) {
  // Null outside the Shell: on the public read-only board there is no Shell, and the
  // card is shown without a menu.
  const openIssue = useContext(IssueOpenerCtx);
  const [open, setOpen] = useState(false);
  // Every card on a board mounts a menu, and a scrolled board mounts cards all the
  // time. The menu's queries, mutations and session are set up the first time it
  // opens, and stay mounted so its dialogs outlive the menu.
  const [everOpened, setEverOpened] = useState(false);

  if (!openIssue) return <>{children}</>;

  return (
    <ContextMenu
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setEverOpened(true);
      }}
    >
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      {everOpened && (
        <IssueMenu
          project={project}
          issue={issue}
          open={open}
          onDeleted={onDeleted}
          onOpenIssue={openIssue}
        />
      )}
    </ContextMenu>
  );
}
