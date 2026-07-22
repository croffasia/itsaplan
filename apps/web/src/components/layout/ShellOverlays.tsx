'use client';

import { useRouter } from 'next/navigation';
import type { ProjectDetail } from '@/lib/api';
import { issuePath, projectPath } from '@/utils/paths';
import type { useOverlays } from '@/hooks/useOverlays';
import NewProjectModal from '@/components/layout/NewProjectModal';
import NewIssueModal from '@/features/issue/components/create/NewIssueModal';
import IssueDetail from '@/features/issue/components/detail/IssueDetail';
import { FloatingChat } from '@/features/ai-chat/components/floating/FloatingChat';

// The project-level overlays the Shell mounts above its content: the new-project
// modal, the new-issue modal, the issue detail panel and the floating AI chat.
// Each renders only while its overlay state says it is open.
export default function ShellOverlays({
  project,
  projectKey,
  overlays,
}: {
  project: ProjectDetail | null;
  projectKey: string | null;
  overlays: ReturnType<typeof useOverlays>;
}) {
  const router = useRouter();

  return (
    <>
      {overlays.showNewProject && (
        <NewProjectModal
          onClose={() => overlays.setShowNewProject(false)}
          onCreated={(key) => {
            overlays.setShowNewProject(false);
            router.push(projectPath(key));
          }}
        />
      )}

      {project && overlays.newIssueDefaults != null && (
        <NewIssueModal
          project={project}
          defaults={overlays.newIssueDefaults}
          onClose={() => overlays.setNewIssueDefaults(null)}
          onCreated={() => overlays.setNewIssueDefaults(null)}
        />
      )}

      {project && overlays.openIssueId != null && (
        <IssueDetail
          project={project}
          issueId={overlays.openIssueId}
          onClose={() => overlays.setOpenIssueId(null)}
          onExpand={(seq) => {
            // Prefer the number the panel loaded; fall back to the board issue.
            const n =
              seq ??
              project.issues.find((i) => i.id === overlays.openIssueId)?.sequenceNumber ??
              null;
            if (projectKey && n != null) router.push(issuePath(projectKey, n));
            overlays.setOpenIssueId(null);
          }}
        />
      )}

      {project && overlays.chatEnabled && (
        <FloatingChat open={overlays.chatOpen} onOpenChange={overlays.setChatOpen} />
      )}
    </>
  );
}
