'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import SectionPageView from '@/components/common/page/SectionPageView';
import { EmptyState } from '@/components/common/page/EmptyState';
import { usePermissions } from '@/hooks/usePermissions';
import { useShell } from '@/context/shellContext';
import { serverConsolePath } from '@/utils/paths';
import type { ManagedServer } from '@/lib/api';
import ServerCustomerGroup from './components/ServerCustomerGroup';
import ServerFormDialog from './components/ServerFormDialog';
import ServerSessionsCard from './components/ServerSessionsCard';
import ServerSummaryCards from './components/ServerSummaryCards';
import { filterServers, groupByCustomer } from './utils/servers';
import {
  useCreateServer,
  useDeleteServer,
  useLinkableCustomersQuery,
  useRepinHostKey,
  useServerOverviewQuery,
  useServerSessionsQuery,
  useServersQuery,
  useUpdateServer,
} from './services/servers.service';

const EMPTY_OVERVIEW = { total: 0, active: 0, customers: 0, sessionsToday: 0, unpinned: 0 };

export default function ServersPage() {
  const router = useRouter();
  const { project } = useShell();
  const { can } = usePermissions();
  const projectKey = project?.project.key ?? '';

  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ManagedServer | null>(null);

  const overviewQuery = useServerOverviewQuery(projectKey);
  const serversQuery = useServersQuery(projectKey);
  const sessionsQuery = useServerSessionsQuery(projectKey);
  const customersQuery = useLinkableCustomersQuery(projectKey);
  const create = useCreateServer(projectKey);
  const update = useUpdateServer(projectKey);
  const remove = useDeleteServer(projectKey);
  const repin = useRepinHostKey(projectKey);

  const servers = useMemo(() => serversQuery.data ?? [], [serversQuery.data]);
  const groups = useMemo(() => groupByCustomer(filterServers(servers, search)), [servers, search]);

  if (!project || serversQuery.isLoading || overviewQuery.isLoading) {
    return <Skeleton className="m-6 flex-1" />;
  }
  if (!can('servers', 'read')) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        You do not have access to Servers.
      </div>
    );
  }

  const overview = overviewQuery.data ?? EMPTY_OVERVIEW;
  const canEdit = can('servers', 'edit');

  return (
    <SectionPageView
      wide
      title="Servers"
      description="The machines you run for customers. Open a terminal straight from here; every session is recorded."
      actions={
        can('servers', 'create') && (
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="size-4" />
            Add server
          </Button>
        )
      }
    >
      <div className="space-y-6">
        <ServerSummaryCards overview={overview} />

        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Filter by name, host, customer or tag…"
            className="h-8 pl-8 text-xs"
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,1fr)]">
          <div className="space-y-6">
            {groups.length === 0 ? (
              <EmptyState
                title={servers.length === 0 ? 'No servers yet' : 'Nothing matches'}
                description={
                  servers.length === 0
                    ? 'Add a machine and you can open its terminal from this page.'
                    : 'Clear the filter or search for something else.'
                }
              />
            ) : (
              groups.map((group) => (
                <ServerCustomerGroup
                  key={group.key}
                  group={group}
                  canEdit={canEdit}
                  canDelete={can('servers', 'delete')}
                  onConnect={(server) => router.push(serverConsolePath(projectKey, server.id))}
                  onEdit={(server) => {
                    setEditing(server);
                    setFormOpen(true);
                  }}
                  onRepin={(server) => repin.mutate(server.id)}
                  onDelete={(server) => remove.mutate(server.id)}
                />
              ))
            )}
          </div>

          <ServerSessionsCard sessions={sessionsQuery.data ?? []} />
        </div>
      </div>

      <ServerFormDialog
        open={formOpen}
        editing={editing}
        customers={customersQuery.data ?? []}
        saving={create.isPending || update.isPending}
        onOpenChange={setFormOpen}
        onSubmit={(input) => {
          if (editing) {
            // An empty credential field means "keep the stored one".
            const { secret, ...rest } = input;
            update.mutate(
              { serverId: editing.id, patch: { ...rest, ...(secret ? { secret } : {}) } },
              { onSuccess: () => setFormOpen(false) },
            );
          } else {
            create.mutate(input, { onSuccess: () => setFormOpen(false) });
          }
        }}
      />
    </SectionPageView>
  );
}
