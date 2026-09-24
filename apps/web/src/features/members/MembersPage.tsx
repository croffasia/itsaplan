'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useShell } from '@/context/shellContext';
import { usePermissions } from '@/hooks/usePermissions';
import SectionPageView from '@/components/common/page/SectionPageView';
import { Button } from '@/components/ui/button';
import InvitesManager from './components/invites/InvitesManager';
import MemberAddDialog from './components/members/MemberAddDialog';
import MembersList from './components/members/MembersList';

// The Members page (/:team/:projectKey/members): who has access to the project.
// Pending invites sit above the members list; the header action opens the dialog
// that adds someone from the team or invites them by email.
export default function MembersPage() {
  const t = useTranslations('members');
  const { project } = useShell();
  const { can, isAdmin } = usePermissions();
  const [adding, setAdding] = useState(false);
  if (!project) return null;

  // Each mirrors the memberAdmin guard on the API: the matrix, or the standing of an
  // owner or manager of the team that runs the project.
  const canAdd = can('members_manage', 'create') || isAdmin;
  const canInvite = can('members_invite', 'create') || isAdmin;
  const canReadInvites = can('members_invite', 'read') || isAdmin;

  return (
    <SectionPageView
      title={t('title')}
      description={t('description')}
      wide
      actions={
        (canAdd || canInvite) && (
          <Button className="gap-1.5" onClick={() => setAdding(true)}>
            <Plus className="size-4" />
            {t('add.action')}
          </Button>
        )
      }
    >
      <InvitesManager projectKey={project.project.ref} />
      <MembersList projectKey={project.project.ref} teamId={project.project.teamId} />

      {adding && (
        <MemberAddDialog
          projectKey={project.project.ref}
          projectName={project.project.name}
          teamId={project.project.teamId}
          teamName={project.project.teamName}
          canAdd={canAdd}
          canInvite={canInvite}
          canGrantOwner={isAdmin}
          canReadInvites={canReadInvites}
          onClose={() => setAdding(false)}
        />
      )}
    </SectionPageView>
  );
}
