import type { ManagedServer } from '@/lib/api';

export function relativeTime(iso: string | null): string {
  if (!iso) return 'never';
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days <= 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString([], { day: '2-digit', month: 'short' });
}

export function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export interface CustomerGroup {
  key: string;
  name: string;
  servers: ManagedServer[];
}

// Groups the machines by the customer they belong to. The operation's own boxes
// have no customer and are listed last, under their own heading.
export function groupByCustomer(servers: ManagedServer[]): CustomerGroup[] {
  const groups = new Map<string, CustomerGroup>();
  for (const item of servers) {
    const key = item.customerId == null ? 'own' : String(item.customerId);
    let group = groups.get(key);
    if (!group) {
      group = { key, name: item.customerName ?? 'Our own machines', servers: [] };
      groups.set(key, group);
    }
    group.servers.push(item);
  }
  return [...groups.values()].sort((a, b) => {
    if (a.key === 'own') return 1;
    if (b.key === 'own') return -1;
    return a.name.localeCompare(b.name);
  });
}

export function filterServers(servers: ManagedServer[], search: string): ManagedServer[] {
  const needle = search.trim().toLowerCase();
  if (needle.length === 0) return servers;
  return servers.filter(
    (item) =>
      item.label.toLowerCase().includes(needle) ||
      item.host.toLowerCase().includes(needle) ||
      item.username.toLowerCase().includes(needle) ||
      (item.customerName ?? '').toLowerCase().includes(needle) ||
      item.tags.some((tag) => tag.toLowerCase().includes(needle)),
  );
}
