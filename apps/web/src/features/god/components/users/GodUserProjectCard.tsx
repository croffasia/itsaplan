'use client';

import { useTranslations } from 'next-intl';
import type { PermissionCatalog } from '@/lib/api/endpoints/roles';
import type { InstanceUserProject } from '@/lib/api/endpoints/god';
import { formatShortDate } from '@/utils/dates';
import { Badge } from '@/components/ui/badge';
import AccessCard from '@/components/common/permissions/AccessCard';

// One project the user can reach, as a row in the account panel.
export default function GodUserProjectCard({
  project,
  catalog,
}: {
  project: InstanceUserProject;
  catalog: PermissionCatalog | undefined;
}) {
  const t = useTranslations('permissions');
  const tCommon = useTranslations('common');
  const isOwner = project.role === 'owner';

  return (
    <AccessCard
      permissions={project.permissions}
      catalog={catalog}
      header={
        <>
          <span className="rounded bg-secondary px-1.5 py-0.5 text-xs font-medium text-secondary-foreground">
            {project.projectKey}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm">{project.projectName}</span>
          <Badge
            variant={isOwner ? 'default' : 'secondary'}
            className="px-1.5 py-0 text-[10px] font-medium"
          >
            {isOwner ? tCommon('owner') : (project.roleName ?? tCommon('member'))}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {t('joined', { date: formatShortDate(project.joinedAt) })}
          </span>
        </>
      }
    />
  );
}
