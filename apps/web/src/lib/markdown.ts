import { marked } from 'marked';
import DOMPurify from 'isomorphic-dompurify';

// Markdown to display-ready HTML. `marked` passes raw HTML in the source
// through untouched, so the result is sanitized before it reaches
// dangerouslySetInnerHTML — markdown values are written by project members and
// agents, and would otherwise be a script injection into every viewer's session.
// breaks:true so a single newline becomes a line break, matching the
// MarkdownEditor used in the issue detail (tiptap-markdown breaks:true).
export function renderMarkdown(value: string): string {
  const html = marked.parse(value, { async: false, breaks: true }) as string;
  return DOMPurify.sanitize(html);
}
