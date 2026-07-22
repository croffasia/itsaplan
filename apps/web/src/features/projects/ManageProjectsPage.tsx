'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Project } from '@/lib/api';
import { useSession } from '@/lib/auth-client';
import { useProjectsQuery } from '@/services/projects.service';
import { projectPath } from '@/utils/paths';
import FullPageView from '@/components/common/page/FullPageView';
import NewProjectModal from '@/components/layout/NewProjectModal';
import ManageProjectsList from './components/ManageProjectsList';
import ManageProjectsDeleteDialog from './components/ManageProjectsDeleteDialog';
import ManageProjectsLeaveDialog from './components/ManageProjectsLeaveDialog';

// The delete/leave mutations drop the project from the cached list, so the row
// disappears without a manual refetch.
export default function ManageProjectsPage() {
  const { data: projects, isPending } = useProjectsQuery();
  const { data: session } = useSession();
  const router = useRouter();
  const [copying, setCopying] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState<Project | null>(null);
  const [leaving, setLeaving] = useState<Project | null>(null);

  return (
    <FullPageView
      label="Manage projects"
      title="Manage projects"
      description="Every project you belong to, with your permissions in each. Copy one to start a new project from its setup. Owners can delete a project; members can leave one. Deleting permanently removes the project and everything in it."
    >
      <ManageProjectsList
        projects={projects ?? []}
        isPending={isPending}
        onCopy={setCopying}
        onDelete={setDeleting}
        onLeave={setLeaving}
      />

      {copying && (
        <NewProjectModal
          copyFrom={copying}
          onClose={() => setCopying(null)}
          onCreated={(key) => {
            setCopying(null);
            router.push(projectPath(key));
          }}
        />
      )}

      {deleting && (
        <ManageProjectsDeleteDialog project={deleting} onClose={() => setDeleting(null)} />
      )}

      {leaving && session?.user.id && (
        <ManageProjectsLeaveDialog
          project={leaving}
          userId={session.user.id}
          onClose={() => setLeaving(null)}
        />
      )}
    </FullPageView>
  );
}
