import type { Project, ProjectFeatures } from '@/lib/api';

// The optional sections plus the estimate kinds and time logging: everything the
// rest of the app checks before showing a field. The sections are the Features page;
// the rest is set in Settings -> Configuration and only hides its own UI.
export interface ProjectFeatureSet extends ProjectFeatures {
  pointsEstimate: boolean;
  timeEstimate: boolean;
  timeLogging: boolean;
}

// The project's flags read as the feature set the rest of the app checks. Without
// a project every section reads as off.
export function projectFeatures(project: Project | null): ProjectFeatureSet {
  return {
    initiatives: project?.initiativesEnabled ?? false,
    cycles: project?.cyclesEnabled ?? false,
    dashboards: project?.dashboardsEnabled ?? false,
    notes: project?.notesEnabled ?? false,
    subtasks: project?.subtasksEnabled ?? false,
    checklists: project?.checklistsEnabled ?? false,
    issueStats: project?.issueStatsEnabled ?? false,
    pointsEstimate: project?.pointsEstimateEnabled ?? false,
    timeEstimate: project?.timeEstimateEnabled ?? false,
    timeLogging: project?.timeLoggingEnabled ?? false,
  };
}
