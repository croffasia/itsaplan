// Issue-type presets offered when creating a project. Mirrors ISSUE_TYPE_PRESETS in
// the API (apps/api/src/projects/store.ts), which is what actually seeds the types;
// the copy here exists so the dialog can preview the result before the request.
export type PresetKey =
  | 'general'
  | 'software'
  | 'product'
  | 'content'
  | 'marketing'
  | 'design'
  | 'sales'
  | 'operations'
  | 'support'
  | 'recruiting';

export const PRESETS: {
  key: PresetKey;
  label: string;
  types: { name: string; color: string }[];
}[] = [
  { key: 'general', label: 'General', types: [{ name: 'Task', color: '#0ea5e9' }] },
  {
    key: 'software',
    label: 'Software',
    types: [
      { name: 'Feature', color: '#8b5cf6' },
      { name: 'Bug', color: '#e11d48' },
      { name: 'Task', color: '#0ea5e9' },
      { name: 'Tech debt', color: '#f97316' },
      { name: 'Research', color: '#14b8a6' },
    ],
  },
  {
    key: 'product',
    label: 'Product',
    types: [
      { name: 'Epic', color: '#8b5cf6' },
      { name: 'Feature', color: '#0ea5e9' },
      { name: 'Feedback', color: '#eab308' },
      { name: 'Research', color: '#14b8a6' },
    ],
  },
  {
    key: 'content',
    label: 'Content',
    types: [
      { name: 'Article', color: '#0ea5e9' },
      { name: 'Video', color: '#e11d48' },
      { name: 'Social post', color: '#8b5cf6' },
      { name: 'Idea', color: '#eab308' },
      { name: 'Review', color: '#22c55e' },
    ],
  },
  {
    key: 'marketing',
    label: 'Marketing',
    types: [
      { name: 'Campaign', color: '#8b5cf6' },
      { name: 'Landing', color: '#0ea5e9' },
      { name: 'Asset', color: '#14b8a6' },
      { name: 'Email', color: '#f97316' },
      { name: 'Research', color: '#22c55e' },
    ],
  },
  {
    key: 'design',
    label: 'Design',
    types: [
      { name: 'Screen', color: '#0ea5e9' },
      { name: 'Component', color: '#8b5cf6' },
      { name: 'Asset', color: '#14b8a6' },
      { name: 'Research', color: '#22c55e' },
    ],
  },
  {
    key: 'sales',
    label: 'Sales',
    types: [
      { name: 'Lead', color: '#0ea5e9' },
      { name: 'Deal', color: '#22c55e' },
      { name: 'Follow-up', color: '#eab308' },
      { name: 'Account', color: '#8b5cf6' },
    ],
  },
  {
    key: 'operations',
    label: 'Operations',
    types: [
      { name: 'Request', color: '#0ea5e9' },
      { name: 'Process', color: '#8b5cf6' },
      { name: 'Purchase', color: '#22c55e' },
      { name: 'Maintenance', color: '#f97316' },
    ],
  },
  {
    key: 'support',
    label: 'Support',
    types: [
      { name: 'Incident', color: '#e11d48' },
      { name: 'Request', color: '#0ea5e9' },
      { name: 'Question', color: '#eab308' },
      { name: 'Change', color: '#8b5cf6' },
    ],
  },
  {
    key: 'recruiting',
    label: 'Recruiting',
    types: [
      { name: 'Candidate', color: '#0ea5e9' },
      { name: 'Onboarding', color: '#22c55e' },
      { name: 'Request', color: '#8b5cf6' },
      { name: 'Policy', color: '#6b7280' },
    ],
  },
];
