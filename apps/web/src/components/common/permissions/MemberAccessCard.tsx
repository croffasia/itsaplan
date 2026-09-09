'use client';

import type { ReactNode } from 'react';
import { Bot } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { PermissionCatalog, Permissions } from '@/lib/api/endpoints/roles';
import Avatar from '@/components/common/Avatar';
import { Badge } from '@/components/ui/badge';
import AccessCard from './AccessCard';
import MemberProfileDetails from './MemberProfileDetails';

// One member of a project, with the access their membership resolves to behind the
// toggle. Rendered wherever a project's member list is shown: the instance project
// panel and the team panel. `actions` holds what the reader may do with the
// membership; it sits outside the toggle, so a control in it opens nothing.
export default function MemberAccessCard({
  member,
  permissions,
  catalog,
  actions,
}: {
  member: {
    name: string;
    email: string;
    username: string | null;
    image: string | null;
    isAgent: boolean;
    role: 'owner' | 'member';
    roleName: string | null;
    description: string;
    timezone: string;
    joinedAt: string;
  };
  // What the membership resolves to, shown behind the toggle. Undefined renders as a
  // skeleton, for a caller that resolves it from the team's roles as they load.
  permissions: Permissions | undefined;
  catalog: PermissionCatalog | undefined;
  actions?: ReactNode;
}) {
  const tCommon = useTranslations('common');
  const isOwner = member.role === 'owner';
  const displayName = member.name || member.email;

  // Under the name: the address for a person, the handle for an agent, whose address
  // is internal to the instance. Nothing when the name line already carries it.
  function secondaryLine(): string | null {
    if (member.isAgent) return member.username ? `@${member.username}` : null;
    return member.name ? member.email : null;
  }
  const secondary = secondaryLine();

  return (
    <AccessCard
      permissions={permissions}
      catalog={catalog}
      details={
        <MemberProfileDetails
          description={member.description}
          timezone={member.timezone}
          joinedAt={member.joinedAt}
        />
      }
      trailing={actions && <div className="flex shrink-0 items-center gap-1 pe-2">{actions}</div>}
      header={
        <>
          <Avatar name={displayName} image={member.image} className="size-8 shrink-0 text-[11px]" />
          <span className="min-w-0 flex-1">
            <span className="flex min-w-0 items-center gap-1.5">
              {member.isAgent && (
                <Bot
                  className="size-3.5 shrink-0 text-muted-foreground"
                  aria-label={tCommon('agent')}
                />
              )}
              <span className="truncate text-sm">{displayName}</span>
            </span>
            {secondary && (
              <span className="block truncate text-xs text-muted-foreground">{secondary}</span>
            )}
          </span>
          <Badge
            variant={isOwner ? 'default' : 'secondary'}
            className="px-1.5 py-0 text-[10px] font-medium"
          >
            {isOwner ? tCommon('owner') : (member.roleName ?? tCommon('member'))}
          </Badge>
        </>
      }
    />
  );
}
