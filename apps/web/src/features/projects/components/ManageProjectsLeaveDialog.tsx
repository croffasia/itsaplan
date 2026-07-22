'use client';

import type { Project } from '@/lib/api';
import { useLeaveProject } from '@/services/projects.service';
import ConfirmDialog from '@/components/common/overlay/ConfirmDialog';

export default function ManageProjectsLeaveDialog({
  project,
  userId,
  onClose,
}: {
  project: Project;
  userId: string;
  onClose: () => void;
}) {
  const leaveProject = useLeaveProject();

  return (
    <ConfirmDialog
      title={`Leave ${project.name}?`}
      confirmLabel="Leave project"
      onClose={onClose}
      onConfirm={async () => {
        await leaveProject.mutateAsync({ projectKey: project.key, userId });
        onClose();
      }}
    >
      <p className="text-sm text-muted-foreground">
        You will lose access to <span className="font-medium text-foreground">{project.name}</span>{' '}
        and its work items. To join again you need a new invite from an owner.
      </p>
    </ConfirmDialog>
  );
}
