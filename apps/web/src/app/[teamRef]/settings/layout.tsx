import type { ReactNode } from 'react';
import ManageTeamsLayout from '@/features/teams/ManageTeamsLayout';
import TeamLayout from '@/features/teams/TeamLayout';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <ManageTeamsLayout>
      <TeamLayout>{children}</TeamLayout>
    </ManageTeamsLayout>
  );
}
