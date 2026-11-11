import type { ComponentType } from 'react';
import type { ProjectDetail } from '@/lib/api/endpoints/projects';

// One tab of the sources on the Import tab. A source has what its tab shows (connect,
// pick what to import, start the job) and the mark its job cards show; `key` is the
// source its jobs carry. A locked source is one another edition imports from: its tab
// carries a lock and says what that edition brings.
export type ImportSourceEntry =
  | {
      kind: 'source';
      key: string;
      label: string;
      Logo: ComponentType<{ className?: string }>;
      Component: ComponentType<{ project: ProjectDetail }>;
    }
  | { kind: 'locked'; key: string; label: string; Component: ComponentType };
