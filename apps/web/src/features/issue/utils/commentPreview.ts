// A comment body is markdown; the bubble shows it as one short run of plain text.
// Markup that carries no words (fences, bullets, emphasis marks, image tokens) is
// dropped; link text and mention handles are kept.
export function commentPreview(body: string): string {
  return body
    .replace(/```[^\n]*\n?|`/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s*(?:[-*+]|\d+\.|>|#{1,6})\s+/gm, '')
    .replace(/[*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
