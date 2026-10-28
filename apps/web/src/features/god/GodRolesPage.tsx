'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { Role } from '@/lib/api/endpoints/roles';
import { usePermissionCatalogQuery } from '@/services/roles.service';
import RoleEditorPanel from '@/components/common/permissions/RoleEditorPanel';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import { Button } from '@/components/ui/button';
import GodSectionPage from './components/GodSectionPage';
import GodRolesTable from './components/roles/GodRolesTable';
import {
  useCreateSystemRole,
  useSystemRolesQuery,
  useUpdateSystemRole,
} from './services/god.service';

// The system roles: permission matrices that belong to no team, which only the
// instance owner creates and edits.
export default function GodRolesPage() {
  const t = useTranslations('god.roles');
  const rolesQuery = useSystemRolesQuery();
  const catalog = usePermissionCatalogQuery().data ?? null;
  const createRole = useCreateSystemRole();
  const updateRole = useUpdateSystemRole();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);
  const roles = rolesQuery.data ?? [];

  return (
    <GodSectionPage
      slug="roles"
      widthClassName="max-w-none"
      actions={
        <Button
          size="sm"
          className="h-8 gap-1.5"
          disabled={!catalog}
          onClick={() => setCreating(true)}
        >
          <Plus className="size-3.5" />
          {t('newRole')}
        </Button>
      }
    >
      {rolesQuery.isPending ? (
        <ListSkeleton rows={3} rowClassName="h-12" />
      ) : roles.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('empty')}</p>
      ) : (
        <GodRolesTable roles={roles} onEdit={setEditing} />
      )}

      {(creating || editing) && catalog && (
        <RoleEditorPanel
          role={editing}
          catalog={catalog}
          saving={createRole.isPending || updateRole.isPending}
          onSave={(input) =>
            editing
              ? updateRole.mutateAsync({ roleId: editing.id, patch: input })
              : createRole.mutateAsync(input)
          }
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </GodSectionPage>
  );
}
