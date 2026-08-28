'use client';

import { useState } from 'react';
import type { InstanceScimGroup } from '@/lib/api';
import { useSetInstanceScimGroupMappings } from '../services/god.service';

// One row of the form: a project the group grants membership in, and the role it
// grants there. `roleId` is null for an owner (owners bypass the permission matrix)
// or to fall back to the project's default role.
export interface ScimMappingDraft {
  projectId: number;
  role: 'owner' | 'member';
  roleId: number | null;
}

export interface GodScimMappingForm {
  mappings: ScimMappingDraft[];
  add: (projectId: number) => void;
  update: (index: number, patch: Partial<ScimMappingDraft>) => void;
  remove: (index: number) => void;
  // Projects already in the list, so the picker does not offer them twice — the API
  // allows at most one mapping per (group, project).
  takenProjectIds: number[];
  dirty: boolean;
  saving: boolean;
  save: () => Promise<void>;
}

function serialize(mappings: ScimMappingDraft[]): string {
  return JSON.stringify([...mappings].sort((a, b) => a.projectId - b.projectId));
}

export function useGodScimMappingForm(group: InstanceScimGroup): GodScimMappingForm {
  const update = useSetInstanceScimGroupMappings();
  const initial: ScimMappingDraft[] = group.mappings.map((m) => ({
    projectId: m.projectId,
    role: m.role,
    roleId: m.roleId,
  }));
  const [mappings, setMappings] = useState<ScimMappingDraft[]>(initial);

  return {
    mappings,
    add: (projectId) =>
      setMappings((current) => [...current, { projectId, role: 'member', roleId: null }]),
    update: (index, patch) =>
      setMappings((current) =>
        current.map((mapping, i) => {
          if (i !== index) return mapping;
          const next = { ...mapping, ...patch };
          // An owner carries no custom role, so switching to owner drops it.
          return next.role === 'owner' ? { ...next, roleId: null } : next;
        }),
      ),
    remove: (index) => setMappings((current) => current.filter((_, i) => i !== index)),
    takenProjectIds: mappings.map((m) => m.projectId),
    dirty: serialize(mappings) !== serialize(initial),
    saving: update.isPending,
    save: async () => {
      await update.mutateAsync({ groupId: group.id, mappings });
    },
  };
}
