import { useContext } from 'react';
import { ShellCtx } from '@/context/shellContext';
import type { ProjectFeatures } from '@/lib/api';

// Which optional sections the active project shows, read from the payload the
// Shell loads. An owner toggles them in Settings -> General.
//
// A disabled section is hidden, not blocked: the rows behind it stay and show
// again once it is turned back on. Without a project every section reads as off,
// the same way usePermissions grants nothing until the project is there.
export function useProjectFeatures(): ProjectFeatures {
  const project = useContext(ShellCtx)?.project ?? null;
  if (!project) return { initiatives: false, cycles: false, dashboards: false, notes: false };
  return {
    initiatives: project.project.initiativesEnabled,
    cycles: project.project.cyclesEnabled,
    dashboards: project.project.dashboardsEnabled,
    notes: project.project.notesEnabled,
  };
}
