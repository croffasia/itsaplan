export type OnboardingSlideId =
  | 'dashboards'
  | 'workItems'
  | 'initiatives'
  | 'cycles'
  | 'documents'
  | 'notes'
  | 'agents'
  | 'schedules'
  | 'workflows'
  | 'portal'
  | 'budgets'
  | 'analytics'
  | 'audit';

export interface OnboardingSlideDef {
  id: OnboardingSlideId;
  // The background of the slide's picture and the dot beside its name, one hue per slide.
  tint: string;
  dot: string;
  // A feature of Pro: drawn in Pro's gold and marked PRO.
  pro?: true;
  // Links to the Pro page in an edition without Pro.
  proLink?: true;
}

const PRO_TINT = 'bg-[#FBF4DA] dark:bg-[#2D2919]';
const PRO_DOT = 'bg-[#E9A52A] dark:bg-[#F2B544]';

export const ONBOARDING_SLIDES: OnboardingSlideDef[] = [
  { id: 'dashboards', tint: 'bg-[#E2F3EF] dark:bg-[#18292A]', dot: 'bg-[#2A9D8F]' },
  { id: 'workItems', tint: 'bg-[#E7EEFC] dark:bg-[#1A2234]', dot: 'bg-[#4C7DEB]' },
  { id: 'initiatives', tint: 'bg-[#EEEAFD] dark:bg-[#231E36]', dot: 'bg-[#7C5CE6]' },
  { id: 'cycles', tint: 'bg-[#FCEDE2] dark:bg-[#30231A]', dot: 'bg-[#E8783D]' },
  { id: 'documents', tint: 'bg-[#E4F3E9] dark:bg-[#1A2A21]', dot: 'bg-[#3C9A62]' },
  { id: 'notes', tint: 'bg-[#FCE9F1] dark:bg-[#311F29]', dot: 'bg-[#DB5B92]' },
  { id: 'agents', tint: 'bg-[#E3F0FA] dark:bg-[#182733]', dot: 'bg-[#2B8FCB]' },
  { id: 'schedules', tint: 'bg-[#E9EAFB] dark:bg-[#1F2138]', dot: 'bg-[#5A64D6]', proLink: true },
  { id: 'workflows', tint: PRO_TINT, dot: PRO_DOT, pro: true, proLink: true },
  { id: 'portal', tint: PRO_TINT, dot: PRO_DOT, pro: true, proLink: true },
  { id: 'budgets', tint: PRO_TINT, dot: PRO_DOT, pro: true, proLink: true },
  { id: 'analytics', tint: PRO_TINT, dot: PRO_DOT, pro: true, proLink: true },
  { id: 'audit', tint: PRO_TINT, dot: PRO_DOT, pro: true, proLink: true },
];
