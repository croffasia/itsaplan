'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { type Notification, type ProjectDetail } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useLiveRefresh } from '@/hooks/useLiveRefresh';
import { revScope } from '@/utils/revScopes';
import { useInboxUnread } from '@/hooks/useInboxUnread';
import { useIsMobile } from '@/hooks/use-mobile';
import InboxToolbar from './InboxToolbar';
import InboxList from './InboxList';
import InboxDetail from './InboxDetail';
import { useInboxFilters } from '../hooks/useInboxFilters';
import {
  useNotificationsQuery,
  useSetNotificationRead,
  useSnoozeNotification,
  useDeleteNotification,
  useMarkAllRead,
  useDeleteNotifications,
} from '../services/notifications.service';

export default function InboxView({ project }: { project: ProjectDetail }) {
  const t = useTranslations('inbox');
  const projectKey = project.project.key;
  const projectId = project.project.id;

  const { filters, changeFilters } = useInboxFilters(projectKey);
  const [selected, setSelected] = useState<Notification | null>(null);
  const isMobile = useIsMobile();

  const query = useNotificationsQuery(projectKey, projectId, filters);
  const unreadQuery = useInboxUnread(projectKey, projectId);
  const setRead = useSetNotificationRead(projectKey);
  const snooze = useSnoozeNotification(projectKey);
  const deleteOne = useDeleteNotification(projectKey);
  const markAllRead = useMarkAllRead(projectKey, projectId);
  const deleteNotifications = useDeleteNotifications(projectKey, projectId);

  const items = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);

  // The unread count refreshes itself through useInboxUnread; this covers the list.
  useLiveRefresh({
    scope: revScope.inbox(projectId),
    targets: [['notifications', projectKey]],
  });

  const onSelect = (n: Notification) => {
    setSelected(n);
    if (n.readAt == null) setRead.mutate({ id: n.id, read: true });
  };

  const onDelete = (n: Notification) => {
    if (selected?.id === n.id) setSelected(null);
    deleteOne.mutate(n.id);
  };

  return (
    <div className="flex h-full min-h-0">
      <div
        className={cn(
          'flex w-full min-w-0 flex-col md:max-w-sm md:border-r',
          selected && 'hidden md:flex',
        )}
      >
        <InboxToolbar
          unread={unreadQuery.data ?? 0}
          filters={filters}
          onFiltersChange={changeFilters}
          onMarkAllRead={() => markAllRead.mutate()}
          onDeleteRead={() => deleteNotifications.mutate('read')}
          onDeleteReadCompleted={() => deleteNotifications.mutate('read-completed')}
        />
        <InboxList
          items={items}
          isLoading={query.isLoading}
          selectedId={selected?.id ?? null}
          onSelect={onSelect}
          onToggleRead={(n, read) => setRead.mutate({ id: n.id, read })}
          onSnooze={(n, until) => snooze.mutate({ id: n.id, until })}
          onDelete={onDelete}
          hasNextPage={query.hasNextPage}
          isFetchingNextPage={query.isFetchingNextPage}
          onLoadMore={() => query.fetchNextPage()}
        />
      </div>

      {selected ? (
        <InboxDetail
          key={selected.issueId}
          project={project}
          issueId={selected.issueId}
          isMobile={isMobile}
          onBack={() => setSelected(null)}
          onDeleted={() => setSelected(null)}
        />
      ) : (
        <div className="hidden flex-1 items-center justify-center text-sm text-muted-foreground md:flex">
          {t('selectNotification')}
        </div>
      )}
    </div>
  );
}
