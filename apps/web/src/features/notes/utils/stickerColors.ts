// Sticky-note background colors, Miro-style: light pastels on the dark canvas.
// The sticker stores the hex directly; a new note defaults to yellow. Legacy or
// empty values fall back to the default so old data keeps rendering.
export const STICKER_PALETTE = [
  '#FFF9B1', // yellow (default)
  '#D5F692', // green
  '#A6D3F5', // blue
  '#F7C1D9', // pink
  '#FFD59E', // orange
  '#D0BFFF', // purple
  '#A8E6D8', // teal
  '#E4E4E7', // grey
];

export const DEFAULT_STICKER_COLOR = STICKER_PALETTE[0];

// The color a sticker renders with. Only a hex is honored; anything else (empty,
// or a legacy key) falls back to the default.
export function stickerColorValue(color: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : DEFAULT_STICKER_COLOR;
}
