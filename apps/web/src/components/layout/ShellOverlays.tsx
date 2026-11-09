'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import { issuePath, projectPath } from '@/utils/paths';
import type { useOverlays } from '@/hooks/useOverlays';

// Every project page mounts the Shell, so these load on first open: a page that opens
// none of them does not download the editor and the pickers they carry.
const NewProjectModal = dynamic(() => import('@/components/layout/NewProjectModal'));
const InitiativeDialog = dynamic(() => import('@/components/common/overlay/InitiativeDialog'));
const NewIssueModal = dynamic(() => import('@/features/issue/components/create/NewIssueModal'));
const IssueDetail = dynamic(() => import('@/features/issue/components/detail/IssueDetail'));

// The project-level overlays the Shell mounts above its content. Each renders only
// while its overlay state says it is open.
export default function ShellOverlays({
  project,
  projectKey,
  newProjectTeamId,
  overlays,
}: {
  project: ProjectDetail | null;
  projectKey: string | null;
  newProjectTeamId: number | undefined;
  overlays: ReturnType<typeof useOverlays>;
}) {
  const router = useRouter();

  return (
    <>
      {newProjectTeamId != null && overlays.showNewProject && (
        <NewProjectModal
          teamId={newProjectTeamId}
          onClose={() => overlays.setShowNewProject(false)}
          onCreated={(key) => {
            overlays.setShowNewProject(false);
            router.push(projectPath(key));
          }}
        />
      )}

      {projectKey && overlays.showNewInitiative && (
        <InitiativeDialog
          projectKey={projectKey}
          onClose={() => overlays.setShowNewInitiative(false)}
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
    </>
  );
}
