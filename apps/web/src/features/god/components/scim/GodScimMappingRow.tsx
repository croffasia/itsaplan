'use client';

import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { InstanceProject } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ScimMappingDraft } from '../../hooks/useGodScimMappingForm';
import { useInstanceProjectQuery } from '../../services/god.service';

// One project a group grants membership in, and the role it grants there. The custom
// roles belong to that project, so they are read from its detail; owners bypass the
// permission matrix and carry none.
const DEFAULT_ROLE = 'default';

export default function GodScimMappingRow({
  mapping,
  projects,
  onChange,
  onRemove,
}: {
  mapping: ScimMappingDraft;
  projects: InstanceProject[];
  onChange: (patch: Partial<ScimMappingDraft>) => void;
  onRemove: () => void;
}) {
  const t = useTranslations('god.scim.mappings');
  const detail = useInstanceProjectQuery(mapping.projectId);
  const project = projects.find((p) => p.id === mapping.projectId);

  return (
    <div className="flex items-center gap-2">
      <div className="min-w-0 flex-1 truncate text-sm">
        {project ? `${project.name} (${project.key})` : mapping.projectId}
      </div>

      <Select
        value={mapping.role}
        onValueChange={(value) => onChange({ role: value as ScimMappingDraft['role'] })}
      >
        <SelectTrigger className="h-9 w-[130px]" aria-label={t('role')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="member">{t('roleMember')}</SelectItem>
          <SelectItem value="owner">{t('roleOwner')}</SelectItem>
        </SelectContent>
      </Select>

      {mapping.role === 'member' && (
        <Select
          value={mapping.roleId === null ? DEFAULT_ROLE : String(mapping.roleId)}
          onValueChange={(value) =>
            onChange({ roleId: value === DEFAULT_ROLE ? null : Number(value) })
          }
        >
          <SelectTrigger className="h-9 w-[150px]" aria-label={t('projectRole')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={DEFAULT_ROLE}>{t('defaultRole')}</SelectItem>
            {(detail.data?.roles ?? []).map((role) => (
              <SelectItem key={role.id} value={String(role.id)}>
                {role.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="shrink-0"
        title={t('remove')}
        onClick={onRemove}
      >
        <X className="size-4" />
      </Button>
    </div>
  );
}
