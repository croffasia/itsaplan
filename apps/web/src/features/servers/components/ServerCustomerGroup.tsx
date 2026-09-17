import type { ManagedServer } from '@/lib/api';
import type { CustomerGroup } from '../utils/servers';
import ServerCard from './ServerCard';

export default function ServerCustomerGroup({
  group,
  canEdit,
  canDelete,
  onConnect,
  onEdit,
  onRepin,
  onDelete,
}: {
  group: CustomerGroup;
  canEdit: boolean;
  canDelete: boolean;
  onConnect: (server: ManagedServer) => void;
  onEdit: (server: ManagedServer) => void;
  onRepin: (server: ManagedServer) => void;
  onDelete: (server: ManagedServer) => void;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3">
        <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {group.name}
        </h3>
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground tabular-nums">
          {group.servers.length} {group.servers.length === 1 ? 'machine' : 'machines'}
        </span>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {group.servers.map((server) => (
          <ServerCard
            key={server.id}
            server={server}
            canEdit={canEdit}
            canDelete={canDelete}
            onConnect={() => onConnect(server)}
            onEdit={() => onEdit(server)}
            onRepin={() => onRepin(server)}
            onDelete={() => onDelete(server)}
          />
        ))}
      </div>
    </section>
  );
}
