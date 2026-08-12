import type { Project, ProjectFeatures } from '@/lib/api';

// The project's flags read as the feature set the rest of the app checks. Without
// a project every section reads as off.
export function projectFeatures(project: Project | null): ProjectFeatures {
  return {
    initiatives: project?.initiativesEnabled ?? false,
    cycles: project?.cyclesEnabled ?? false,
    dashboards: project?.dashboardsEnabled ?? false,
    notes: project?.notesEnabled ?? false,
    subtasks: project?.subtasksEnabled ?? false,
    checklists: project?.checklistsEnabled ?? false,
    issueStats: project?.issueStatsEnabled ?? false,
  };
}
