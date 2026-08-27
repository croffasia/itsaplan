import { marked } from 'marked';
import DOMPurify from 'isomorphic-dompurify';
import { parseChartSpec, type ChartSpec } from '@/utils/chartSpec';
import { mediaUrl } from '@/lib/api';

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

// A file the user attached to a chat message arrives as a marker with the
// attachment id: [file: "Jira.csv" (attachment id: 7e01be81-…)]. Shown as-is it
// would be raw text with a uuid, so it renders the way charts and the import
// card do — replaced with the file name and a download link, here for markdown
// content and in AgentChatMessage for the plain-text user bubble.
export const FILE_MARKER = /\[file: "([^"]+)" \(attachment id: ([0-9a-f-]{36})\)\]/gi;

export function fileMarkerUrl(id: string): string {
  return mediaUrl(`/chat-attachments/${id}/raw?download=1`);
}

function linkFileMarkers(text: string): string {
  return text.replace(FILE_MARKER, (_, name: string, id: string) => {
    const label = name.replace(/[[\]\\]/g, '\\$&');
    return `[${label}](${fileMarkerUrl(id)})`;
  });
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
  | { kind: 'chart'; spec: ChartSpec; source: string }
  // An import review card the user confirms or discards (see AgentChatImportCard).
  | { kind: 'issue-import'; importId: string; source: string };

const CHART_TAG = 'chart';
const IMPORT_TAG = 'issue-import';

// The one field an issue-import fence carries: which draft the card shows. The
// draft itself is read from the API by the card, so a model writing extra JSON
// around it cannot forge rows.
function parseImportRef(text: string): string | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end < start) return null;
  let value: unknown;
  try {
    value = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const id = (value as Record<string, unknown>).importId;
  return typeof id === 'string' && id ? id : null;
}

interface OpenFence {
  // The run of backticks or tildes the block is closed by.
  marker: string;
  // The word between the marker and the body, lowercased.
  tag: string;
  // What of the body the opening line already carries, for a model that started the
  // JSON on it rather than on the next line.
  body: string;
  // That line closed the block as well, so the whole block is one line.
  closed: boolean;
}

function openFence(line: string): OpenFence | null {
  const match = /^(`{3,}|~{3,})(.*)$/.exec(line.trim());
  if (!match) return null;
  const [, marker, rest] = match;
  const brace = rest.indexOf('{');
  const tag = (brace === -1 ? rest : rest.slice(0, brace)).trim().toLowerCase();
  let body = brace === -1 ? '' : rest.slice(brace).trim();
  const closed = body.endsWith(marker);
  if (closed) body = body.slice(0, -marker.length);
  return { marker, tag, body, closed };
}

// The markdown between the chart fences, and the specs of the fences themselves. Every
// fenced block is offered to parseChartSpec, not only one tagged `chart`: the tag is
// written by a model, and the check a spec goes through is strict enough that a block
// passing it is a chart. A block that is not one stays in the markdown, so a model that
// wrote malformed JSON shows it as the code block it is instead of vanishing.
export function markdownSegments(value: string, options?: HtmlOptions): MarkdownSegment[] {
  const lines = value.split('\n');
  const segments: MarkdownSegment[] = [];
  let buffer: string[] = [];

  function flush(): void {
    const text = buffer.join('\n');
    buffer = [];
    if (text.trim())
      segments.push({ kind: 'markdown', html: renderMarkdown(linkFileMarkers(text), options) });
  }

  for (let i = 0; i < lines.length; i++) {
    const fence = openFence(lines[i]);
    if (!fence) {
      buffer.push(lines[i]);
      continue;
    }
    let end = i;
    let source = fence.body;
    if (!fence.closed) {
      end = i + 1;
      while (end < lines.length && lines[end].trim() !== fence.marker) end++;
      if (end === lines.length) {
        // Only a fence the model tagged holds a place while it streams in: an untagged
        // one is as likely to be the code block it looks like.
        if (fence.tag !== CHART_TAG && fence.tag !== IMPORT_TAG) {
          buffer.push(...lines.slice(i));
          break;
        }
        flush();
        segments.push({ kind: 'pending' });
        return segments;
      }
      source = [...(fence.body ? [fence.body] : []), ...lines.slice(i + 1, end)].join('\n');
    }
    const spec = parseChartSpec(source);
    const importId = spec ? null : parseImportRef(source);
    if (spec) {
      flush();
      segments.push({ kind: 'chart', spec, source });
    } else if (importId) {
      flush();
      segments.push({ kind: 'issue-import', importId, source });
    } else {
      buffer.push(...lines.slice(i, end + 1));
    }
    i = end;
  }
  flush();
  return segments;
}
