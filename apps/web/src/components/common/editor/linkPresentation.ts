import { marked, type Token, type Tokens } from 'marked';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { linkPreviewDestination } from './linkPreviewDestination';

export type LinkOccurrence = { url: string; label: string; from: number; to: number };
export type EditorLinkBlock = {
  from: number;
  to: number;
  links: LinkOccurrence[];
  bare: boolean;
};

export function previewUrl(url: string, origin: string): URL | null {
  const parsed = linkPreviewDestination(url, origin);
  if (
    !parsed ||
    /\/(?:raw|download)(?:\/|$)/i.test(parsed.pathname) ||
    parsed.searchParams.has('download')
  )
    return null;
  return parsed;
}

export function bareMarkdownUrls(source: string): Set<string> {
  const bare = new Set<string>();
  const named = new Set<string>();
  const tokens = marked.lexer(source, { breaks: true, gfm: true });
  marked.walkTokens(tokens, (token: Token) => {
    if (token.type === 'link' && token.raw.startsWith('[')) named.add((token as Tokens.Link).href);
    if (token.type !== 'paragraph') return;
    const parts = (token as Tokens.Paragraph).tokens.filter(
      (part) => part.type !== 'text' || part.raw.trim() !== '',
    );
    if (parts.length !== 1 || parts[0].type !== 'link') return;
    const link = parts[0] as Tokens.Link;
    if (link.text === link.href && (link.raw === link.href || link.raw === `<${link.href}>`))
      bare.add(link.href);
  });
  for (const url of named) bare.delete(url);
  return bare;
}

export function editorLinkBlocks(
  doc: ProseMirrorNode,
  bareUrls: ReadonlySet<string>,
  origin: string,
): EditorLinkBlock[] {
  const blocks: EditorLinkBlock[] = [];
  doc.descendants((node, position) => {
    if (node.type.name === 'table' || node.type.name === 'codeBlock') return false;
    if (!node.isTextblock) return;
    const links: LinkOccurrence[] = [];
    let onlyLinkText = true;
    node.forEach((child, offset) => {
      const mark = child.marks.find((item) => item.type.name === 'link');
      const url = typeof mark?.attrs.href === 'string' ? mark.attrs.href : '';
      if (
        !child.isText ||
        child.marks.some((item) => item.type.name === 'code') ||
        !previewUrl(url, origin) ||
        !url
      ) {
        if (!child.isText || child.text?.trim()) onlyLinkText = false;
        return;
      }
      const from = position + 1 + offset;
      const previous = links.at(-1);
      if (previous?.url === url && previous.to === from) {
        previous.label += child.text ?? '';
        previous.to += child.nodeSize;
      } else links.push({ url, label: child.text ?? '', from, to: from + child.nodeSize });
    });
    if (links.length) {
      blocks.push({
        from: position,
        to: position + node.nodeSize,
        links,
        bare:
          node.type.name === 'paragraph' &&
          onlyLinkText &&
          links.length === 1 &&
          node.textContent.trim() === links[0].url &&
          bareUrls.has(links[0].url),
      });
    }
    return false;
  });
  return blocks;
}

export function linkDestination(url: string, origin: string) {
  const parsed = new URL(url, origin);
  return { hostname: parsed.hostname.replace(/^www\./, ''), pathname: parsed.pathname };
}
