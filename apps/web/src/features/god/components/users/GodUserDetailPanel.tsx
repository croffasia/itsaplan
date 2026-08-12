'use client';

import { useState, type ReactNode } from 'react';
import { Bot, FolderOpen, MailWarning, Shield, Trash2, TriangleAlert, X } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { formatDate, formatDateTime } from '@/utils/dates';
import { useExitOnEscape } from '@/hooks/useExitOnEscape';
import Avatar from '@/components/common/Avatar';
import ConfirmDialog from '@/components/common/overlay/ConfirmDialog';
import ListSkeleton from '@/components/common/skeleton/ListSkeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { usePermissionCatalogQuery } from '@/services/roles.service';
import { useDeleteInstanceUser, useInstanceUserQuery } from '../../services/god.service';
import { useProviderList } from '../../hooks/useProviderList';
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
  const t = useTranslations('god.userPanel');
  const tCommon = useTranslations('common');
  const providerList = useProviderList();
  const userQuery = useInstanceUserQuery(userId);
  const catalogQuery = usePermissionCatalogQuery();
  const deleteUser = useDeleteInstanceUser();
  const [confirming, setConfirming] = useState(false);
  const [withProjects, setWithProjects] = useState(false);
  const user = userQuery.data;

  // Projects this user owns alone. Deleting the account leaves them without anyone
  // who can manage them, so the API refuses unless they are deleted along with it.
  const soleOwned = (user?.projects ?? []).filter((p) => p.role === 'owner' && p.ownerCount === 1);

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
    toast.success(t(withProjects ? 'deletedWithProjects' : 'deleted'));
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
                {user ? user.name || user.email : tCommon('loading')}
              </h2>
              <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
              {user && (
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  {user.role === 'god' ? (
                    <Badge className="gap-1 px-1.5 py-0 text-[10px] font-medium">
                      <Shield className="size-3" />
                      {t('instanceOwner')}
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-medium">
                      {t('user')}
                    </Badge>
                  )}
                  {user.isAgent && (
                    <Badge
                      variant="secondary"
                      className="gap-1 px-1.5 py-0 text-[10px] font-medium"
                    >
                      <Bot className="size-3" />
                      {t('aiAgent')}
                    </Badge>
                  )}
                  {user.emailVerified && (
                    <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-medium">
                      {t('emailVerified')}
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>
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

        <div className="flex-1 space-y-8 overflow-y-auto px-6 py-6">
          {!user ? (
            <ListSkeleton rows={5} rowClassName="h-12" />
          ) : (
            <>
              {!user.emailVerified && (
                <div className="flex items-start gap-3 rounded-lg bg-muted/60 p-4">
                  <MailWarning className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="text-sm font-medium">{t('unconfirmedTitle')}</p>
                    <p className="text-xs text-muted-foreground">{t('unconfirmedHint')}</p>
                  </div>
                  <GodUserVerifyButton userId={user.id} />
                </div>
              )}

              <section className="grid grid-cols-2 gap-x-6 gap-y-5">
                <Fact label={t('signInMethods')}>
                  {user.providers.length ? (
                    providerList(user.providers)
                  ) : (
                    <span className="text-muted-foreground">{t('noProviders')}</span>
                  )}
                </Fact>
                <Fact label={t('projects')}>
                  {user.projectCount === 0 ? (
                    <span className="text-muted-foreground">{t('noProjects')}</span>
                  ) : (
                    user.projectCount
                  )}
                </Fact>
                <Fact label={t('registered')}>{formatDate(user.createdAt)}</Fact>
                <Fact label={t('lastSeen')}>
                  {user.lastSeenAt ? (
                    formatDateTime(user.lastSeenAt)
                  ) : (
                    <span className="text-muted-foreground">{t('neverSignedIn')}</span>
                  )}
                </Fact>
              </section>

              <section className="space-y-3">
                <div className="flex items-baseline gap-2">
                  <h3 className="text-sm font-medium">{t('projectAccess')}</h3>
                  {user.projects.length > 0 && (
                    <span className="text-xs text-muted-foreground">{user.projects.length}</span>
                  )}
                </div>
                {user.projects.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 rounded-lg bg-muted/30 px-6 py-10 text-center">
                    <FolderOpen className="size-5 text-muted-foreground" />
                    <p className="text-sm font-medium">{t('noAccessTitle')}</p>
                    <p className="max-w-[36ch] text-xs text-muted-foreground">
                      {t('noAccessHint')}
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
            <p className="text-xs text-muted-foreground">{t('deleteHint')}</p>
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
              {tCommon('delete')}
            </Button>
          </div>
        )}
      </div>

      {confirming && user && (
        <ConfirmDialog
          title={t('deleteTitle')}
          confirmLabel={
            withProjects
              ? t('deleteConfirmWithProjects', { count: soleOwned.length })
              : t('deleteConfirm')
          }
          confirmDisabled={soleOwned.length > 0 && !withProjects}
          onConfirm={confirmDelete}
          onClose={() => setConfirming(false)}
        >
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t.rich('deleteMessage', {
                name: user.name || user.email,
                strong: (chunks) => <span className="font-medium text-foreground">{chunks}</span>,
              })}
            </p>

            {soleOwned.length > 0 && (
              <div className="space-y-4 rounded-lg bg-muted/60 p-4">
                <div className="flex items-start gap-2.5">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
                  <div className="min-w-0 space-y-2">
                    <p className="text-sm font-medium">
                      {t('soleOwnerTitle', { count: soleOwned.length })}
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
                      {t('soleOwnerHint', { count: soleOwned.length })}
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
                      {t('deleteWithProjects', { count: soleOwned.length })}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {t(withProjects ? 'deleteWithProjectsOn' : 'deleteWithProjectsOff')}
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
