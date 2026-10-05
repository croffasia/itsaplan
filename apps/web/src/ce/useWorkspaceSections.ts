import type { WorkspaceSummary } from '@/lib/api/endpoints/workspaces';
import type { WorkspaceExtraSection } from '@/features/teams/types/workspaceSection';

// A self-hosted instance adds no section to a workspace's settings. The hosted build
// resolves `@/cloud` to a hook that returns its own, such as single sign-on and billing.
export default function useWorkspaceSections(
  _workspace: WorkspaceSummary,
): WorkspaceExtraSection[] {
  return [];
}
