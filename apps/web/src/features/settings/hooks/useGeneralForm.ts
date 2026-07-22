'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import type { ProjectDetail } from '@/lib/api';
import { useUpdateProject } from '@/services/projects.service';
import { usePermissions } from '@/hooks/usePermissions';

export interface GeneralForm {
  key: string;
  name: string;
  description: string;
  setName: (v: string) => void;
  setDescription: (v: string) => void;
  // Only an owner may edit; others see the current values read-only.
  editable: boolean;
  saving: boolean;
  canSave: boolean;
  save: () => Promise<void>;
}

// Form state for the General settings page: the project name and description. The
// key is read-only. Shared between the header Save button and the body fields, so
// it lives in a hook and is threaded into both.
export function useGeneralForm(project: ProjectDetail): GeneralForm {
  const { isOwner } = usePermissions();
  const { key, name: savedName, description: savedDescription } = project.project;
  const updateProject = useUpdateProject();

  const [name, setName] = useState(savedName);
  const [description, setDescription] = useState(savedDescription);

  const trimmedName = name.trim();
  const dirty = trimmedName !== savedName || description !== savedDescription;
  const canSave = isOwner && trimmedName.length > 0 && dirty && !updateProject.isPending;

  async function save() {
    await updateProject.mutateAsync({
      projectKey: key,
      patch: { name: trimmedName, description },
    });
    toast.success('Project updated');
  }

  return {
    key,
    name,
    description,
    setName,
    setDescription,
    editable: isOwner,
    saving: updateProject.isPending,
    canSave,
    save,
  };
}
