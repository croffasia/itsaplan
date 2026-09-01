'use client';

import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import type { InstanceScimGroup } from '@/lib/api';
import Modal from '@/components/common/overlay/Modal';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import GodScimMappingRow from './GodScimMappingRow';
import { useGodScimMappingForm } from '../../hooks/useGodScimMappingForm';
import { useInstanceProjectsQuery } from '../../services/god.service';

// What one provisioned group grants. Saving reconciles the membership of every
// project the change touched, so a project taken off this list loses the members the
// group put there.
export default function GodScimGroupMappingDialog({
  group,
  onClose,
}: {
  group: InstanceScimGroup;
  onClose: () => void;
}) {
  const t = useTranslations('god.scim.mappings');
  const tCommon = useTranslations('common');
  const form = useGodScimMappingForm(group);
  // One page wide enough to hold every project of a self-hosted instance; the picker
  // is a dropdown, not a searchable list.
  const projects = useInstanceProjectsQuery({ search: '', limit: 200, offset: 0 });

  const available = (projects.data?.items ?? []).filter(
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
              <GodScimMappingRow
                key={mapping.projectId}
                mapping={mapping}
                projects={projects.data?.items ?? []}
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
