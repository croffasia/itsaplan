'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import type { PermissionCatalog, Permissions } from '@/lib/api/endpoints/roles';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import DisclosureCard from '@/components/common/DisclosureCard';
import PermissionMatrix from './PermissionMatrix';

// One membership, from either side of it: a project the user can reach, or a member
// of the project. `header` is what the row states about that side, `trailing` the
// controls that act on it; the matrix behind the toggle spells the access out per
// resource.
export default function AccessCard({
  header,
  trailing,
  details,
  permissions,
  catalog,
}: {
  header: ReactNode;
  trailing?: ReactNode;
  // Shown above the matrix: a member's profile. A project row has none.
  details?: ReactNode;
  permissions: Permissions | undefined;
  catalog: PermissionCatalog | undefined;
}) {
  const t = useTranslations('permissions');

  return (
    <DisclosureCard header={header} trailing={trailing}>
      <div className="space-y-5">
        {details}
        <section>
          <h4 className="mb-2 text-sm font-medium">{t('accessHeading')}</h4>
          {catalog && permissions ? (
            <PermissionMatrix catalog={catalog} permissions={permissions} />
          ) : (
            <ListSkeleton rows={3} rowClassName="h-6" />
          )}
        </section>
      </div>
    </DisclosureCard>
  );
}
