import { marked } from 'marked';
import DOMPurify from 'isomorphic-dompurify';
import { parseChartSpec, type ChartSpec } from '@/utils/chartSpec';

// Content whose links lead away from the current view (release notes, agent chat)
// asks for newTabLinks, so following one does not replace what the reader was on.
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

// A chart an agent embedded in its answer, as one fenced block:
//
//   ```chart
//   { "type": "bar", "x": "week", "series": [...], "data": [...] }
//   ```
//
// The spec is what the create_chart tool hands back; the fence is how the agent
// places it in the text. Splitting the fences out is what draws them as charts
// instead of the JSON code block `marked` would produce.
export type MarkdownSegment =
  | { kind: 'markdown'; html: string }
  // The fence is still open: the answer is streaming in and the spec is incomplete.
  | { kind: 'pending' }
  // `source` is the fence body the spec was parsed from: the answer is re-split on
  // every streamed token, so it is what tells an unchanged chart from a new one.
  | { kind: 'chart'; spec: ChartSpec; source: string };

const OPEN_FENCE = '```chart';
const CLOSE_FENCE = '```';

// The markdown between the chart fences, and the specs of the fences themselves. A
// fence whose body is not a valid spec is left in the markdown, so a model that wrote
// malformed JSON shows it as the code block it is instead of vanishing.
export function markdownSegments(value: string, options?: HtmlOptions): MarkdownSegment[] {
  const lines = value.split('\n');
  const segments: MarkdownSegment[] = [];
  let buffer: string[] = [];

  function flush(): void {
    const text = buffer.join('\n');
    buffer = [];
    if (text.trim()) segments.push({ kind: 'markdown', html: renderMarkdown(text, options) });
  }

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() !== OPEN_FENCE) {
      buffer.push(lines[i]);
      continue;
    }
    let end = i + 1;
    while (end < lines.length && lines[end].trim() !== CLOSE_FENCE) end++;
    if (end === lines.length) {
      flush();
      segments.push({ kind: 'pending' });
      return segments;
    }
    const source = lines.slice(i + 1, end).join('\n');
    const spec = parseChartSpec(source);
    if (spec) {
      flush();
      segments.push({ kind: 'chart', spec, source });
    } else {
      buffer.push(...lines.slice(i, end + 1));
    }
    i = end;
  }
  flush();
  return segments;
}
