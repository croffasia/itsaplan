'use client';

import { useState, type ReactNode } from 'react';
import { Bot, FolderOpen, MailWarning, Shield, Trash2, TriangleAlert, X } from 'lucide-react';
import { toast } from 'sonner';
import { formatDate, formatDateTime } from '@/utils/dates';
import { useExitOnEscape } from '@/hooks/useExitOnEscape';
import Avatar from '@/components/common/Avatar';
import ConfirmDialog from '@/components/common/overlay/ConfirmDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { usePermissionCatalogQuery } from '@/services/roles.service';
import { useDeleteInstanceUser, useInstanceUserQuery } from '../../services/god.service';
import { providerList } from '../../utils/providers';
import GodUserProjectCard from './GodUserProjectCard';
import GodUserVerifyButton from './GodUserVerifyButton';

// One fact in the account grid: a quiet label with the value under it. Reading down
// a column beats a row of label/value pairs when the values differ in length.
function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm">{children}</div>
    </div>
  );
}

// One account in a right-hand side panel (the same surface the role editor uses):
// the account facts and every project it can reach, each with the permissions its
// membership resolves to. Escape or a backdrop click closes it.
export default function GodUserDetailPanel({
  userId,
  onClose,
}: {
  userId: string;
  onClose: () => void;
}) {
  const userQuery = useInstanceUserQuery(userId);
  const catalogQuery = usePermissionCatalogQuery();
  const deleteUser = useDeleteInstanceUser();
  const [confirming, setConfirming] = useState(false);
  const [withProjects, setWithProjects] = useState(false);
  const user = userQuery.data;

  // Projects this user owns alone. Deleting the account leaves them without anyone
  // who can manage them, so the API refuses unless they are deleted along with it.
  const soleOwned = (user?.projects ?? []).filter((p) => p.role === 'owner' && p.ownerCount === 1);
  const one = soleOwned.length === 1;

  // Escape closes the confirm dialog first; the panel stays until it is gone.
  useExitOnEscape(() => {
    if (!confirming) onClose();
  });

  // An instance owner keeps god mode reachable, and an agent's bot user belongs to
  // its AI Agent config. The API refuses both; the button is hidden for them too.
  const removable = user ? user.role !== 'god' && !user.isAgent : false;

  async function confirmDelete() {
    await deleteUser.mutateAsync({ userId, withProjects });
    setConfirming(false);
    toast.success(withProjects ? 'Account and its projects deleted' : 'Account deleted');
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-40 flex bg-black/20"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="ml-auto flex h-full w-full flex-col border-l bg-card sm:w-[680px] sm:max-w-[92vw]">
        <div className="flex shrink-0 items-start justify-between gap-3 bg-muted/30 px-6 pt-5 pb-4">
          <div className="flex min-w-0 items-start gap-3.5">
            <Avatar
              name={user?.name || user?.email || '?'}
              image={user?.image}
              className="size-11 shrink-0 text-sm"
            />
            <div className="min-w-0 space-y-1.5">
              <h2 className="truncate text-base font-semibold">
                {user ? user.name || user.email : 'Loading…'}
              </h2>
              <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
              {user && (
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  {user.role === 'god' ? (
                    <Badge className="gap-1 px-1.5 py-0 text-[10px] font-medium">
                      <Shield className="size-3" />
                      Instance owner
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-medium">
                      User
                    </Badge>
                  )}
                  {user.isAgent && (
                    <Badge
                      variant="secondary"
                      className="gap-1 px-1.5 py-0 text-[10px] font-medium"
                    >
                      <Bot className="size-3" />
                      AI agent
                    </Badge>
                  )}
                  {user.emailVerified && (
                    <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-medium">
                      Email verified
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>
          <Button variant="ghost" size="icon" className="size-7" onClick={onClose} title="Close">
            <X />
          </Button>
        </div>

        <div className="flex-1 space-y-8 overflow-y-auto px-6 py-6">
          {!user ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <>
              {!user.emailVerified && (
                <div className="flex items-start gap-3 rounded-lg bg-muted/60 p-4">
                  <MailWarning className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="text-sm font-medium">Email address not confirmed</p>
                    <p className="text-xs text-muted-foreground">
                      Confirm it here when the link never reached them.
                    </p>
                  </div>
                  <GodUserVerifyButton userId={user.id} />
                </div>
              )}

              <section className="grid grid-cols-2 gap-x-6 gap-y-5">
                <Fact label="Sign-in methods">
                  {user.providers.length ? (
                    providerList(user.providers)
                  ) : (
                    <span className="text-muted-foreground">None linked</span>
                  )}
                </Fact>
                <Fact label="Projects">
                  {user.projectCount === 0 ? (
                    <span className="text-muted-foreground">None</span>
                  ) : (
                    user.projectCount
                  )}
                </Fact>
                <Fact label="Registered">{formatDate(user.createdAt)}</Fact>
                <Fact label="Last seen">
                  {user.lastSeenAt ? (
                    formatDateTime(user.lastSeenAt)
                  ) : (
                    <span className="text-muted-foreground">Never signed in</span>
                  )}
                </Fact>
              </section>

              <section className="space-y-3">
                <div className="flex items-baseline gap-2">
                  <h3 className="text-sm font-medium">Project access</h3>
                  {user.projects.length > 0 && (
                    <span className="text-xs text-muted-foreground">{user.projects.length}</span>
                  )}
                </div>
                {user.projects.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 rounded-lg bg-muted/30 px-6 py-10 text-center">
                    <FolderOpen className="size-5 text-muted-foreground" />
                    <p className="text-sm font-medium">No project access</p>
                    <p className="max-w-[36ch] text-xs text-muted-foreground">
                      This account reaches nothing until someone invites it to a project.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {user.projects.map((p) => (
                      <GodUserProjectCard
                        key={p.projectId}
                        project={p}
                        catalog={catalogQuery.data}
                      />
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>

        {removable && (
          <div className="flex shrink-0 items-center justify-between gap-4 bg-muted/30 px-6 py-3">
            <p className="text-xs text-muted-foreground">
              Issues and comments stay, with the author unassigned.
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => {
                setWithProjects(false);
                setConfirming(true);
              }}
            >
              <Trash2 />
              Delete
            </Button>
          </div>
        )}
      </div>

      {confirming && user && (
        <ConfirmDialog
          title="Delete account"
          confirmLabel={
            withProjects ? `Delete account and ${one ? 'project' : 'projects'}` : 'Delete account'
          }
          confirmDisabled={soleOwned.length > 0 && !withProjects}
          onConfirm={confirmDelete}
          onClose={() => setConfirming(false)}
        >
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{user.name || user.email}</span> loses
              access to this instance. Issues and comments they wrote stay, with the author
              unassigned. This cannot be undone.
            </p>

            {soleOwned.length > 0 && (
              <div className="space-y-4 rounded-lg bg-muted/60 p-4">
                <div className="flex items-start gap-2.5">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
                  <div className="min-w-0 space-y-2">
                    <p className="text-sm font-medium">
                      Only owner of {one ? 'a project' : `${soleOwned.length} projects`}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {soleOwned.map((p) => (
                        <span
                          key={p.projectId}
                          className="rounded bg-secondary px-1.5 py-0.5 text-xs font-medium text-secondary-foreground"
                        >
                          {p.projectKey}
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Once the account is gone, nobody can manage {one ? 'it' : 'them'}.
                    </p>
                  </div>
                </div>

                <label className="flex cursor-pointer items-start gap-2.5 rounded-md bg-background/60 p-3 transition-colors hover:bg-background">
                  <Checkbox
                    checked={withProjects}
                    onCheckedChange={(v) => setWithProjects(v === true)}
                    className="mt-0.5"
                  />
                  <span className="space-y-0.5">
                    <span className="block text-sm">
                      Delete {one ? 'the project' : 'the projects'} with the account
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {withProjects
                        ? 'Everything inside goes too.'
                        : 'Or cancel and add a second owner first.'}
                    </span>
                  </span>
                </label>
              </div>
            )}
          </div>
        </ConfirmDialog>
      )}
    </div>
  );
}
