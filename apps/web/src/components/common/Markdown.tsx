import { useMemo } from 'react';
import { renderMarkdown } from '@/lib/markdown';

// Renders markdown text as formatted HTML with the shared `.md-content` styles
// (headings, lists, code, blockquote, links), without the virtualized-table image
// sizing the markdown table cell adds.
export default function Markdown({ children }: { children: string }) {
  const html = useMemo(() => renderMarkdown(children), [children]);
  // `dir="auto"` reads the direction from the text itself, so an Arabic comment in
  // an English interface — and the reverse — is laid out the way it was written.
  return <div dir="auto" className="md-content" dangerouslySetInnerHTML={{ __html: html }} />;
}
