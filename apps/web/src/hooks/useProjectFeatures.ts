import { useContext } from 'react';
import { ShellCtx } from '@/context/shellContext';
import type { ProjectFeatures } from '@/lib/api';

// Which optional sections the active project shows, read from the payload the
// Shell loads. An owner toggles them in Settings -> General.
//
// A disabled section is hidden, not blocked: the rows behind it stay and show
// again once it is turned back on. Everything is on until the project is loaded,
// so the navigation does not flicker on the first render.
export function useProjectFeatures(): ProjectFeatures {
  const project = useContext(ShellCtx)?.project ?? null;
  if (!project) return { initiatives: true, dashboards: true, notes: true };
  return {
    initiatives: project.project.initiativesEnabled,
    dashboards: project.project.dashboardsEnabled,
    notes: project.project.notesEnabled,
  };
}
