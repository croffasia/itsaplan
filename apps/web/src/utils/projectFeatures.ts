import type { ProjectFeatures } from '@/lib/api';

// What each optional section is called in the navigation. Shared by the switches
// that turn a section off, their confirmation, and the notice the section shows
// while it is off, so it is named the same everywhere.
export const FEATURE_LABEL: Record<keyof ProjectFeatures, string> = {
  initiatives: 'Initiatives',
  dashboards: 'Dashboards',
  notes: 'Notes',
};
