import type {
  GitManagedRepository,
  GitProviderConnection,
  GitRepository,
} from '@/lib/api/endpoints/git';
import { GIT_PROVIDER_CONFIG } from '@/utils/gitProviderConfig';

export interface ManagedRepositoryEntry {
  connection: GitProviderConnection;
  repository: GitManagedRepository;
}

// A delivery names its host by label ("GitHub"), a connection by key ("github"). A
// Forgejo server can answer on a connection saved as Gitea, so the two count as one.
function sameHost(connection: GitProviderConnection, deliveryProvider: string): boolean {
  const host = (label: string) => (label === 'Forgejo' ? 'Gitea' : label);
  return host(GIT_PROVIDER_CONFIG[connection.provider].label) === host(deliveryProvider);
}

export function managedRepositories(
  connections: GitProviderConnection[],
): ManagedRepositoryEntry[] {
  return connections.flatMap((connection) =>
    connection.repositories.map((repository) => ({ connection, repository })),
  );
}

// The repositories that deliver through a webhook made by hand: they sent events but
// are not connected through a provider account.
export function manualRepositories(
  delivered: GitRepository[],
  managed: ManagedRepositoryEntry[],
): GitRepository[] {
  return delivered.filter(
    (item) =>
      !managed.some(
        ({ connection, repository }) =>
          sameHost(connection, item.provider) &&
          repository.fullName.toLowerCase() === item.repo.toLowerCase(),
      ),
  );
}

// The account a webhook-only repository can be connected through, if one is on its host.
export function accountForHost(
  connections: GitProviderConnection[],
  deliveryProvider: string,
): GitProviderConnection | null {
  return connections.find((connection) => sameHost(connection, deliveryProvider)) ?? null;
}
