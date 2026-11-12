import type onboarding from '../../../../messages/en/onboarding.json';

// The surfaces of the slide pictures, taken from the theme so a picture follows light and
// dark. Each picture adds its own accent.
export const CARD =
  'fill-card drop-shadow-[0_8px_14px_rgba(24,24,48,0.1)] dark:drop-shadow-[0_10px_18px_rgba(0,0,0,0.5)]';
export const SOFT = 'fill-muted';
export const LINE = 'fill-border';
export const INK = 'fill-foreground';
export const SUB = 'fill-muted-foreground';

// Pro's gold, in the pictures of the Pro features. Deeper on light, where the lighter gold
// of the dark theme fades.
export const GOLD = 'fill-[#E9A52A] dark:fill-[#F2B544]';
export const GOLD_STROKE = 'stroke-[#E9A52A] dark:stroke-[#F2B544]';
export const GOLD_SOFT = 'fill-[#E9A52A]/16 dark:fill-[#F2B544]/18';
export const GOLD_TEXT = 'fill-[#8A6410] dark:fill-[#F2B544]';
export const GOLD_ICON = 'text-[#8A6410] dark:text-[#F2B544]';

// The issue titles the pictures draw from.
export type SampleIssue = keyof (typeof onboarding)['art']['issues'];

// A moment of the month the date pictures are drawn in. Fixed, so the month grid keeps its
// shape: November 2026 starts on a Sunday and the pictures put today on the 12th.
export function sampleDate(day: number, hour = 0, minute = 0) {
  return new Date(2026, 10, day, hour, minute);
}
