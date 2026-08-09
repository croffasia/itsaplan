// Normalize one tiptap-markdown line-break marker per line so repeated editor
// round trips cannot turn it into visible text.
export function stripMarkdownBreakMarkers(markdown: string): string {
  return markdown.replace(/\\(?=\r?(?:\n|$))/g, '');
}
