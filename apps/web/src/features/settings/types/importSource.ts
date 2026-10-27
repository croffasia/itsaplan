import type { ComponentType } from 'react';
import type { ProjectDetail } from '@/lib/api/endpoints/projects';

// One tab of the sources on the Import tab: a source with what its tab shows (connect,
// pick what to import, start the job), or a link to the editions with more sources.
export type ImportSourceEntry =
  | {
      kind: 'source';
      key: string;
      label: string;
      Component: ComponentType<{ project: ProjectDetail }>;
    }
  | { kind: 'more'; key: string; label: string; hint: string };
