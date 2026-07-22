'use client';

import { useState } from 'react';
import type { Project } from '@/lib/api';
import { useDeleteProject } from '@/services/projects.service';
import ConfirmDialog from '@/components/common/overlay/ConfirmDialog';
import { Input } from '@/components/ui/input';

export default function ManageProjectsDeleteDialog({
  project,
  onClose,
}: {
  project: Project;
  onClose: () => void;
}) {
  const [confirmText, setConfirmText] = useState('');
  const deleteProject = useDeleteProject();
  const matches = confirmText.trim() === project.key;

  return (
    <ConfirmDialog
      title={`Delete ${project.name}?`}
      confirmLabel="Delete permanently"
      confirmDisabled={!matches}
      onClose={onClose}
      onConfirm={async () => {
        await deleteProject.mutateAsync(project.key);
        onClose();
      }}
    >
      <div className="space-y-2 text-sm text-muted-foreground">
        <p>
          This permanently deletes{' '}
          <span className="font-medium text-foreground">{project.name}</span> and everything in it:
          issues, comments, attachments, and settings. This cannot be undone.
        </p>
        <p>
          Type <span className="font-mono font-medium text-foreground">{project.key}</span> to
          confirm.
        </p>
      </div>
      <Input
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        placeholder={project.key}
        autoFocus
      />
    </ConfirmDialog>
  );
}
