// The title a dump gets when the author did not name it. A capture is often one
// unbroken run of text, so taking the first line is not enough: the first sentence
// is taken and then cut back to a word boundary. That keeps the fallback readable
// both as a card heading and as an Obsidian file name.
export const TITLE_MAX = 70;

export function deriveTitle(body: string): string {
  const firstLine = body.split('\n').find((line) => line.trim().length > 0) ?? '';
  const sentence = firstLine.split(/(?<=[.!?])\s/)[0] ?? '';
  const candidate = (sentence.trim().length > 0 ? sentence : firstLine).trim().replace(/\s+/g, ' ');
  if (candidate.length === 0) return 'Untitled dump';
  if (candidate.length <= TITLE_MAX) return candidate.replace(/[.,;:]+$/, '');

  const cut = candidate.slice(0, TITLE_MAX);
  const lastSpace = cut.lastIndexOf(' ');
  // A run of text with no spaces has no word boundary to fall back to.
  const clipped = lastSpace > TITLE_MAX / 2 ? cut.slice(0, lastSpace) : cut;
  return `${clipped.replace(/[.,;:]+$/, '')}…`;
}
