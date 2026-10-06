import type { WorkspaceSummary } from '@/lib/api/endpoints/workspaces';
import type { WorkspaceSection } from '@/features/teams/types/workspaceSection';

// A self-hosted instance lists the core's workspace settings sections as they are. The
// hosted build returns them with its own added at any position, such as single sign-on
// and billing, or with one left out.
export default function useWorkspaceSections(
  _workspace: WorkspaceSummary,
  core: WorkspaceSection[],
): WorkspaceSection[] {
  return core;
}
