import { useContext } from 'react';
import { ShellCtx } from '@/context/shellContext';
import { projectFeatures, type ProjectFeatureSet } from '@/utils/projectFeatures';

// Which optional sections the active project shows and which estimate kinds its
// issues carry, read from the payload the Shell loads. An owner toggles the
// sections in Settings -> General, the estimate kinds in Settings -> Configuration.
//
// A disabled section is hidden, not blocked: the rows behind it stay and show
// again once it is turned back on. Without a project every section reads as off,
// the same way usePermissions grants nothing until the project is there.
export function useProjectFeatures(): ProjectFeatureSet {
  return projectFeatures(useContext(ShellCtx)?.project?.project ?? null);
}
