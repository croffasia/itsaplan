import type { ReactNode } from 'react';
import ManageTeamsLayout from '@/features/teams/ManageTeamsLayout';
import WorkspaceLayout from '@/features/teams/WorkspaceLayout';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <ManageTeamsLayout>
      <WorkspaceLayout>{children}</WorkspaceLayout>
    </ManageTeamsLayout>
  );
}
