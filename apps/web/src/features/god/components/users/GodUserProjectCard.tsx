'use client';

import type { InstanceUserProject, PermissionCatalog } from '@/lib/api';
import { formatShortDate } from '@/utils/dates';
import { Badge } from '@/components/ui/badge';
import GodAccessCard from '../GodAccessCard';

// One project the user can reach, as a row in the account panel.
export default function GodUserProjectCard({
  project,
  catalog,
}: {
  project: InstanceUserProject;
  catalog: PermissionCatalog | undefined;
}) {
  const isOwner = project.role === 'owner';

  return (
    <GodAccessCard
      isOwner={isOwner}
      roleName={project.roleName}
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
            {isOwner ? 'Owner' : (project.roleName ?? 'Member')}
          </Badge>
          <span className="text-xs text-muted-foreground">
            joined {formatShortDate(project.joinedAt)}
          </span>
        </>
      }
    />
  );
}
