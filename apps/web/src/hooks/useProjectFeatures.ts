import { useContext } from 'react';
import { ShellCtx } from '@/context/shellContext';
import { projectFeatures } from '@/utils/projectFeatures';
import type { ProjectFeatures } from '@/lib/api';

// Which optional sections the active project shows, read from the payload the
// Shell loads. An owner toggles them in Settings -> General.
//
// A disabled section is hidden, not blocked: the rows behind it stay and show
// again once it is turned back on. Without a project every section reads as off,
// the same way usePermissions grants nothing until the project is there.
export function useProjectFeatures(): ProjectFeatures {
  return projectFeatures(useContext(ShellCtx)?.project?.project ?? null);
}
