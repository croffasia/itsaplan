import type { StudioAspect, StudioLayout, StudioTemplateInput } from '@/lib/api';

export const LAYOUT_OPTIONS: { value: StudioLayout; label: string; description: string }[] = [
  {
    value: 'statement',
    label: 'Statement',
    description: 'Lead and headline at the top, a render squared off below',
  },
  {
    value: 'feature',
    label: 'Feature',
    description: 'Headline, a row of pills, and a wide product shot',
  },
  {
    value: 'announcement',
    label: 'Announcement',
    description: 'An opening line, the message in a framed card, a button below',
  },
  {
    value: 'overlay',
    label: 'Overlay',
    description: 'Photo across the whole plate, large text along the bottom',
  },
];

export const ASPECT_OPTIONS: { value: StudioAspect; label: string }[] = [
  { value: 'square', label: 'Square (1:1)' },
  { value: 'portrait', label: 'Portrait (4:5)' },
  { value: 'story', label: 'Story (9:16)' },
];

// Fonts the canvas can measure without loading anything: the app's own face plus
// the families every platform ships. A family the browser does not have falls back
// to the system sans, which would change the wrapping.
export const FONT_OPTIONS = [
  'Inter Variable',
  'Georgia',
  'Times New Roman',
  'Verdana',
  'Trebuchet MS',
  'Courier New',
];

// What each layout does with the three text fields, so the composer can label them
// for the layout in front of the user.
export const FIELD_LABELS: Record<
  StudioLayout,
  { lead: string; headline: string; subtext: string }
> = {
  statement: { lead: 'Lead line', headline: 'Headline', subtext: 'Supporting line' },
  feature: { lead: 'Lead line', headline: 'Headline', subtext: 'Supporting line' },
  announcement: { lead: 'Opening line', headline: 'Message in the card', subtext: 'Small print' },
  overlay: { lead: 'Lead line', headline: 'Headline', subtext: 'Large text at the bottom' },
};

const MONOCHROME_STYLE_PROMPT = [
  'Monochrome black and white product render, no colour.',
  'Chrome and frosted glass materials, studio lighting, soft reflections and a subtle glow.',
  'Pure black background, centred subject, generous empty space around it.',
  'No text, no logos, no watermarks, no user interface.',
].join(' ');

export const DEFAULT_TEMPLATE: StudioTemplateInput = {
  name: '',
  layout: 'statement',
  aspect: 'portrait',
  backgroundColor: '#000000',
  textColor: '#ffffff',
  accentColor: '#9ca3af',
  fontFamily: 'Inter Variable',
  stylePrompt: MONOCHROME_STYLE_PROMPT,
  credentialId: null,
  imageModel: 'google/gemini-3.1-flash-image',
  textModel: '',
};

// The pill labels a post carries, from the comma-separated text the field holds.
export function parseChips(value: string): string[] {
  return value
    .split(',')
    .map((chip) => chip.trim())
    .filter((chip) => chip.length > 0)
    .slice(0, 3);
}
