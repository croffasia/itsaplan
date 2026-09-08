'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, LogOut, Pencil, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { MemberRole } from '@/lib/api/endpoints/members';
import type { TeamProject, TeamRole } from '@/lib/api/endpoints/teams';
import { useSession } from '@/lib/auth-client';
import { projectPath } from '@/utils/paths';
import RowAction from '@/components/common/RowAction';
import NewProjectModal from '@/components/layout/NewProjectModal';
import TeamProjectDeleteDialog from './TeamProjectDeleteDialog';
import TeamProjectEditModal from './TeamProjectEditModal';
import TeamProjectLeaveDialog from './TeamProjectLeaveDialog';

// What the reader may do with one project of the team, as the actions of the panel
// header. Editing and copying follow their rank in the team — a manager does both,
// an owner also deletes — while leaving follows their membership in the project,
// which its last owner, and anyone a provisioned group put there, cannot give up.
export default function TeamProjectActions({
  teamId,
  teamRole,
  project,
  viewer,
}: {
  teamId: number;
  teamRole: TeamRole;
  project: TeamProject;
  viewer: { role: MemberRole; source: 'invite' | 'scim' } | null;
}) {
  const t = useTranslations('projects');
  const router = useRouter();
  const { data: session } = useSession();
  const [editing, setEditing] = useState(false);
  const [copying, setCopying] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const userId = session?.user.id;
  const isLastOwner = viewer?.role === 'owner' && project.owners.length === 1;
  // A provisioned membership ends at the identity provider, so it is not given up here.
  const canLeave = !!viewer && !isLastOwner && viewer.source !== 'scim';
  const canEdit = teamRole !== 'member';
  const canDelete = teamRole === 'owner';

  return (
    <div className="flex items-center gap-1">
      {canEdit && (
        <>
          <RowAction icon={Pencil} label={t('editAction')} onClick={() => setEditing(true)} />
          <RowAction icon={Copy} label={t('copyAction')} onClick={() => setCopying(true)} />
        </>
      )}
      {canLeave && (
        <RowAction icon={LogOut} label={t('leaveAction')} onClick={() => setLeaving(true)} />
      )}
      {canDelete && (
        <RowAction
          icon={Trash2}
          label={t('deleteAction')}
          destructive
          onClick={() => setDeleting(true)}
        />
      )}

      {editing && (
        <TeamProjectEditModal teamId={teamId} project={project} onClose={() => setEditing(false)} />
      )}

      {copying && (
        <NewProjectModal
          teamId={teamId}
          copyFrom={project}
          onClose={() => setCopying(false)}
          onCreated={(key) => {
            setCopying(false);
            router.push(projectPath(key));
          }}
        />
      )}

      {deleting && (
        <TeamProjectDeleteDialog
          teamId={teamId}
          project={project}
          onClose={() => setDeleting(false)}
        />
      )}

      {leaving && userId && (
        <TeamProjectLeaveDialog
          project={project}
          userId={userId}
          onClose={() => setLeaving(false)}
        />
      )}
    </div>
  );
}
