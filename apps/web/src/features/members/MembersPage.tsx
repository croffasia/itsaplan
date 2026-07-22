'use client';

import { useShell } from '@/context/shellContext';
import SectionPageView from '@/components/common/page/SectionPageView';
import InvitesManager from './components/invites/InvitesManager';
import MembersList from './components/members/MembersList';

// The Members page (/project/:projectKey/members): who has access to the project.
// Pending invites and the invite form sit above the members list.
export default function MembersPage() {
  const { project } = useShell();
  if (!project) return null;
  return (
    <SectionPageView
      title="Members"
      description="People with access to this project. Invite people by email; owners can revoke access."
      wide
    >
      <InvitesManager projectKey={project.project.key} />
      <MembersList projectKey={project.project.key} />
    </SectionPageView>
  );
}
