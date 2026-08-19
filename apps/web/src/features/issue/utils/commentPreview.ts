import { MENTION_RE } from './mentions';

// A comment body is markdown; the bubble shows it as one short run of plain text.
// Markup that carries no words (fences, bullets, emphasis marks, image tokens) is
// dropped; link text and mention names are kept.
export function commentPreview(body: string): string {
  return body
    .replace(/```[^\n]*\n?|`/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(MENTION_RE, '@$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s*(?:[-*+]|\d+\.|>|#{1,6})\s+/gm, '')
    .replace(/[*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
