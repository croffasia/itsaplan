'use client';

import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import type { WorkspaceScimGroup } from '@/lib/api/endpoints/workspaces';
import { useWorkspaceProjectOptionsQuery } from '@/services/workspaces.service';
import Modal from '@/components/common/overlay/Modal';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import WorkspaceScimMappingRow from './WorkspaceScimMappingRow';
import { useWorkspaceScimMappingForm } from '../../../hooks/useWorkspaceScimMappingForm';

// What one provisioned group grants. Saving reconciles the membership of every
// project the change touched, so a project taken off this list loses the members the
// group put there.
export default function WorkspaceScimGroupMappingDialog({
  workspaceId,
  group,
  onClose,
}: {
  workspaceId: number;
  group: WorkspaceScimGroup;
  onClose: () => void;
}) {
  const t = useTranslations('teams.workspace.scim.mappings');
  const tCommon = useTranslations('common');
  const form = useWorkspaceScimMappingForm(workspaceId, group);
  const projects = useWorkspaceProjectOptionsQuery(workspaceId);

  const available = (projects.data ?? []).filter(
    (project) => !form.takenProjectIds.includes(project.id),
  );

  async function save() {
    try {
      await form.save();
      toast.success(t('saved'));
      onClose();
    } catch {
      // The failure already surfaced through the global mutation error toast.
    }
  }

  return (
    <Modal title={t('title', { group: group.displayName })} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{t('description')}</p>

        {form.mappings.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">{t('empty')}</p>
        ) : (
          <div className="space-y-3">
            {form.mappings.map((mapping, index) => (
              <WorkspaceScimMappingRow
                key={mapping.projectId}
                mapping={mapping}
                projects={projects.data ?? []}
                onChange={(patch) => form.update(index, patch)}
                onRemove={() => form.remove(index)}
              />
            ))}
          </div>
        )}

        <Select value="" onValueChange={(value) => form.add(Number(value))}>
          <SelectTrigger className="w-full" disabled={available.length === 0}>
            <SelectValue placeholder={t('addProject')} />
          </SelectTrigger>
          <SelectContent>
            {available.map((project) => (
              <SelectItem key={project.id} value={String(project.id)}>
                {project.name} ({project.key})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={form.saving}>
            {tCommon('cancel')}
          </Button>
          <Button type="button" onClick={() => void save()} disabled={!form.dirty || form.saving}>
            {form.saving ? tCommon('saving') : tCommon('save')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
