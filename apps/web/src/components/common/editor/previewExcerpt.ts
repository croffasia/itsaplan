import { marked, type Token } from 'marked';

function tokenText(token: Token): string {
  if (token.type === 'html') return '';
  if ('tokens' in token && token.tokens) return token.tokens.map(tokenText).join('');
  if (token.type === 'list')
    return token.items.flatMap((item: { tokens: Token[] }) => item.tokens.map(tokenText)).join(' ');
  if (token.type === 'table')
    return [...token.header, ...token.rows.flat()]
      .map((cell) => cell.tokens.map(tokenText).join(' '))
      .join(' ');
  return 'text' in token && typeof token.text === 'string' ? token.text : '';
}

export function previewExcerpt(markdown: string, limit = 280): string {
  const text = marked
    .lexer(markdown.slice(0, 12_000))
    .map(tokenText)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > limit ? `${text.slice(0, limit).trimEnd()}…` : text;
}
