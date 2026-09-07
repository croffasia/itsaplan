// The optional sections a project can turn off (Settings -> General). The names are
// the keys of ProjectFeatures and the values a hosted build blocks through
// `Limits.blockedFeatures`, so they live here rather than beside either one.
export const PROJECT_FEATURES = [
  'dashboards',
  'initiatives',
  'cycles',
  'documents',
  'notes',
  'subtasks',
  'checklists',
  'issueStats',
] as const;

export type ProjectFeature = (typeof PROJECT_FEATURES)[number];

// "issueStats" -> "Issue stats", for the errors that name a section.
export function featureLabel(feature: ProjectFeature): string {
  const words = feature.replace(/([A-Z])/g, ' $1').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
