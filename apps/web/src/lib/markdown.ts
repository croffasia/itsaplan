import { marked } from 'marked';
import DOMPurify from 'isomorphic-dompurify';

// Content that links away from the app (release notes) asks for newTabLinks, so a
// link does not replace the app with GitHub.
export interface HtmlOptions {
  newTabLinks?: boolean;
}

function newTab(node: Element): void {
  if (node.tagName === 'A' && node.hasAttribute('href')) {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noreferrer');
  }
}

// HTML that arrives already rendered, made safe for dangerouslySetInnerHTML. Used
// for release notes, which GitHub renders and the api passes through unchanged.
export function sanitizeHtml(html: string, options?: HtmlOptions): string {
  if (!options?.newTabLinks) return DOMPurify.sanitize(html);
  DOMPurify.addHook('afterSanitizeAttributes', newTab);
  try {
    return DOMPurify.sanitize(html);
  } finally {
    DOMPurify.removeHook('afterSanitizeAttributes');
  }
}

// Markdown to display-ready HTML. `marked` passes raw HTML in the source
// through untouched, so the result is sanitized before it reaches
// dangerouslySetInnerHTML — markdown values are written by project members and
// agents, and would otherwise be a script injection into every viewer's session.
// breaks:true so a single newline becomes a line break, matching the
// MarkdownEditor used in the issue detail (tiptap-markdown breaks:true).
export function renderMarkdown(value: string, options?: HtmlOptions): string {
  const html = marked.parse(value, { async: false, breaks: true }) as string;
  return sanitizeHtml(html, options);
}
