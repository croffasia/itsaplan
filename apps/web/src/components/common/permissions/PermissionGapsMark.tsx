'use client';

import { CircleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { Permissions } from '@/lib/api/endpoints/roles';
import { permissionGaps } from '@/utils/permissions';
import { usePermissionCatalogQuery } from '@/services/roles.service';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// Marks a role whose matrix is out of granting order, for whoever can edit the role.
export function PermissionGapsMark({ permissions }: { permissions: Permissions }) {
  const t = useTranslations('permissions');
  const catalog = usePermissionCatalogQuery().data;
  if (!catalog || permissionGaps(catalog, permissions).length === 0) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          role="img"
          aria-label={t('gaps.hint')}
          tabIndex={0}
          className="shrink-0 rounded-sm text-warning"
        >
          <CircleAlert className="size-4" />
        </span>
      </TooltipTrigger>
      <TooltipContent>{t('gaps.hint')}</TooltipContent>
    </Tooltip>
  );
}
