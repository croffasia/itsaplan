'use client';

import { useShell } from '@/context/shellContext';
import SectionPageView from '@/components/common/page/SectionPageView';
import RolesManager from './components/roles/RolesManager';
import RolesToolbar from './components/roles/RolesToolbar';

// The Roles page (/project/:projectKey/members/roles): the project's custom roles
// and their permissions. Assigning a role to a member is done from the Members list.
export default function RolesPage() {
  const { project } = useShell();
  if (!project) return null;
  const projectKey = project.project.key;
  return (
    <SectionPageView
      title="Roles"
      description="Custom roles and the permissions each grants. Assign a role to a member from the Members list."
      actions={<RolesToolbar projectKey={projectKey} />}
      wide
    >
      <RolesManager projectKey={projectKey} />
    </SectionPageView>
  );
}
