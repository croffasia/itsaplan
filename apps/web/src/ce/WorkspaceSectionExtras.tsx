'use client';

import type { Workspace } from '@/lib/api/endpoints/workspaces';

// Below the content of a workspace settings page, by its slug ('general', 'managers'). A
// self-hosted instance adds nothing; the hosted build renders its own settings into an
// existing page, with controls that save themselves, since the page's Save covers only
// its own fields.
export default function WorkspaceSectionExtras(_props: { slug: string; workspace: Workspace }) {
  return null;
}
