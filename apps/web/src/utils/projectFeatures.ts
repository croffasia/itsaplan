import type { Project, ProjectFeatures } from '@/lib/api';

// What each optional section is called. Shared by the switches that turn a section
// off, their confirmation, and the notice the section shows while it is off, so it
// is named the same everywhere.
export const FEATURE_LABEL: Record<keyof ProjectFeatures, string> = {
  initiatives: 'Initiatives',
  cycles: 'Cycles',
  dashboards: 'Dashboards',
  notes: 'Notes',
  subtasks: 'Subtasks',
  checklists: 'Checklists',
  issueStats: 'Issue stats',
};

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
