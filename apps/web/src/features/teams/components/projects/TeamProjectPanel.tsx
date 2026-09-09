'use client';

import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { TeamProject, TeamRole } from '@/lib/api/endpoints/teams';
import { formatDate, formatDateTime } from '@/utils/dates';
import { useExitOnEscape } from '@/hooks/useExitOnEscape';
import { useTeamProjectQuery } from '@/services/teams.service';
import { useSession } from '@/lib/auth-client';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import { Button } from '@/components/ui/button';
import TeamProjectActions from './TeamProjectActions';
import TeamProjectMembers from './TeamProjectMembers';
import TeamProjectStats from './TeamProjectStats';

// One project of the team in a right-hand side panel (the same surface the role
// editor uses): what the project is and what the reader may do with it in the
// header, then how its issues stand and who can reach it. Escape or a backdrop click
// closes it.
export default function TeamProjectPanel({
  teamId,
  teamName,
  teamRole,
  project,
  onClose,
}: {
  teamId: number;
  teamName: string;
  teamRole: TeamRole;
  project: TeamProject;
  onClose: () => void;
}) {
  const t = useTranslations('teams.panel');
  const tCommon = useTranslations('common');
  const { data: detail } = useTeamProjectQuery(teamId, project.id);
  const { data: session } = useSession();

  useExitOnEscape(onClose);

  // An owner or manager of the team manages the members of every project it owns, and
  // so does an owner of the project itself; anyone else acts through the member
  // permission of their own membership, as the project's members page does. The API
  // enforces the same pair.
  const viewer = detail?.viewer ?? null;
  const runsProject = teamRole === 'owner' || teamRole === 'manager' || viewer?.role === 'owner';
  const canEdit = runsProject || viewer?.permissions.members_manage.edit === true;
  const canDelete = runsProject || viewer?.permissions.members_manage.delete === true;
  const canAdd = runsProject || viewer?.permissions.members_manage.create === true;
  const canInvite = runsProject || viewer?.permissions.members_invite.create === true;
  const canReadInvites = runsProject || viewer?.permissions.members_invite.read === true;

  return (
    <div
      className="fixed inset-0 z-40 flex bg-black/20"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="ml-auto flex h-full w-full flex-col border-l bg-card sm:w-[680px] sm:max-w-[92vw]">
        <div className="flex shrink-0 items-center justify-between gap-3 bg-muted/30 px-6 py-4">
          <div className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 text-xs font-medium text-secondary-foreground">
              {project.key}
            </span>
            <h2 className="truncate text-base font-semibold">{project.name}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <TeamProjectActions
              teamId={teamId}
              teamRole={teamRole}
              project={project}
              viewer={viewer}
            />
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={onClose}
              title={tCommon('close')}
            >
              <X />
            </Button>
          </div>
        </div>

        <div className="flex-1 space-y-8 overflow-y-auto px-6 py-6">
          {!detail ? (
            <ListSkeleton rows={5} rowClassName="h-12" />
          ) : (
            <>
              <section className="space-y-3">
                {project.description && (
                  <p dir="auto" className="text-sm text-foreground">
                    {project.description}
                  </p>
                )}
                <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-muted-foreground">
                  <span>{t('created', { date: formatDate(project.createdAt) })}</span>
                  <span>
                    {t('lastActivity', {
                      value: detail.lastActivityAt
                        ? formatDateTime(detail.lastActivityAt)
                        : t('noActivity'),
                    })}
                  </span>
                </div>
                <TeamProjectStats stats={detail.stats} />
              </section>

              <TeamProjectMembers
                teamId={teamId}
                projectId={project.id}
                projectKey={project.key}
                ownerCount={project.owners.length}
                viewerId={session?.user.id}
                projectName={project.name}
                teamName={teamName}
                canEdit={canEdit}
                canDelete={canDelete}
                canAdd={canAdd}
                canInvite={canInvite}
                canGrantOwner={runsProject}
                canReadInvites={canReadInvites}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
