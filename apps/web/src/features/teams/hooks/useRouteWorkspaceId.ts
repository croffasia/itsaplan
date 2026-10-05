import { useParams } from 'next/navigation';

// The workspace the path names (/workspaces/:workspaceId), or null off those routes.
export function useRouteWorkspaceId(): number | null {
  const { workspaceId } = useParams<{ workspaceId?: string }>();
  return workspaceId ? Number(workspaceId) : null;
}
