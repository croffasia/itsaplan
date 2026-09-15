import { marked } from 'marked';
import DOMPurify from 'isomorphic-dompurify';
import type { BoardIssue } from '@/lib/api/endpoints/issues';
import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import { groupKeyOf } from '@/utils/project';
import type { GroupField } from '@/utils/viewSettings';

export interface ColumnSearchRange {
  start: number;
  end: number;
}

export interface ColumnSearchText {
  text: string;
  normalized: string;
  sourceRanges: ColumnSearchRange[] | null;
}

type ContentSource =
  { source: 'description'; fieldName?: never } | { source: 'customField'; fieldName: string };

type SearchContent = ContentSource & { value: ColumnSearchText };

export interface ColumnSearchEntry {
  issue: BoardIssue;
  title: ColumnSearchText;
  identifier: ColumnSearchText;
  content: SearchContent[];
}

export type ColumnSearchExcerpt = ContentSource & {
  text: string;
  ranges: ColumnSearchRange[];
};

export interface ColumnSearchResult {
  issue: BoardIssue;
  title: string;
  identifier: string;
  titleRanges: ColumnSearchRange[];
  identifierRanges: ColumnSearchRange[];
  excerpt: ColumnSearchExcerpt | null;
}

const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const blockElements = new Set([
  'address',
  'article',
  'blockquote',
  'dd',
  'div',
  'dl',
  'dt',
  'figcaption',
  'figure',
  'footer',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'hr',
  'li',
  'main',
  'ol',
  'p',
  'pre',
  'section',
  'table',
  'td',
  'th',
  'tr',
  'ul',
]);

function normalize(value: string): string {
  return value.normalize('NFC').toLowerCase().normalize('NFC');
}

function withoutEmbeddedUrls(value: string): string {
  return value.replace(/\b(?:data|blob):[^\s<>"')\]]*/gi, '');
}

function readableNode(node: Node): string {
  if (node.nodeType === 3) return node.textContent ?? '';
  const element = node.nodeType === 1 ? (node as Element) : null;
  const tag = element?.localName;
  if (tag === 'script' || tag === 'style' || tag === 'template') return '';
  if (tag === 'br') return '\n';
  if (tag === 'img') return element?.getAttribute('alt') ?? '';
  const text = Array.from(node.childNodes, readableNode).join('');
  if (tag === 'a') {
    const href = element?.getAttribute('href');
    return href && !/^(?:data|blob):/i.test(href) && href !== text ? `${text} ${href} ` : text;
  }
  return tag && blockElements.has(tag) ? `${text}\n` : text;
}

function readableMarkdown(value: string): string {
  if (!value.trim()) return '';
  const html = marked.parse(value, { async: false, breaks: true });
  const fragment = DOMPurify.sanitize(html, { RETURN_DOM_FRAGMENT: true });
  return withoutEmbeddedUrls(readableNode(fragment)).replace(/\r?\n/g, ' ').trim();
}

function prepareText(value: string): ColumnSearchText {
  const text = withoutEmbeddedUrls(value);
  const normalized = normalize(text);
  let sourceRanges: ColumnSearchRange[] | null = null;
  if (normalized.length !== text.length || text.normalize('NFC') !== text) {
    sourceRanges = [];
    for (const { segment, index } of graphemes.segment(text)) {
      const range = { start: index, end: index + segment.length };
      for (let i = 0; i < normalize(segment).length; i++) sourceRanges.push(range);
    }
  }
  return { text, normalized, sourceRanges };
}

export function prepareColumnSearchEntries(
  issues: readonly BoardIssue[],
  customFields: ProjectDetail['customFields'],
): ColumnSearchEntry[] {
  const fields = new Map(customFields.map((field) => [field.id, field]));
  const seen = new Set<number>();
  const entries: ColumnSearchEntry[] = [];
  for (const issue of issues) {
    if (issue.archivedAt || seen.has(issue.id)) continue;
    seen.add(issue.id);
    const content: SearchContent[] = [];
    const description = readableMarkdown(issue.description);
    if (description) content.push({ source: 'description', value: prepareText(description) });
    for (const fieldValue of issue.fieldValues) {
      const field = fields.get(fieldValue.fieldId);
      if (!field) continue;
      let text = '';
      if (field.fieldType === 'select' || field.fieldType === 'multi_select') {
        text = field.options
          .filter((option) => fieldValue.optionIds.includes(option.id))
          .map((option) => option.value)
          .join(', ');
      } else if (
        ['text', 'markdown', 'url'].includes(field.fieldType) &&
        typeof fieldValue.value === 'string'
      ) {
        text =
          field.fieldType === 'markdown' ? readableMarkdown(fieldValue.value) : fieldValue.value;
      }
      if (text) {
        content.push({ source: 'customField', fieldName: field.name, value: prepareText(text) });
      }
    }
    entries.push({
      issue,
      title: prepareText(issue.title),
      identifier: prepareText(issue.identifier),
      content,
    });
  }
  return entries;
}

export function columnSearchEntriesForGroup(
  entries: readonly ColumnSearchEntry[],
  groupField: GroupField,
  groupKey: string,
): ColumnSearchEntry[] {
  return entries.filter((entry) => groupKeyOf(entry.issue, groupField) === groupKey);
}

function sourceRange(value: ColumnSearchText, start: number, end: number): ColumnSearchRange {
  return {
    start: value.sourceRanges?.[start].start ?? start,
    end: value.sourceRanges?.[end - 1].end ?? end,
  };
}

function matchRanges(value: ColumnSearchText, query: string): ColumnSearchRange[] {
  const ranges: ColumnSearchRange[] = [];
  if (!query) return ranges;
  let start = value.normalized.indexOf(query);
  while (start !== -1) {
    const range = sourceRange(value, start, start + query.length);
    const previous = ranges.at(-1);
    if (previous && previous.end >= range.start) previous.end = range.end;
    else ranges.push(range);
    start = value.normalized.indexOf(query, start + query.length);
  }
  return ranges;
}

function excerptFor(content: SearchContent, query: string, index: number): ColumnSearchExcerpt {
  const { value: prepared, ...source } = content;
  const match = sourceRange(prepared, index, index + query.length);
  const value = prepared.text;
  let start = Math.max(0, match.start - 40);
  if (start > 0) {
    const space = value.indexOf(' ', start);
    if (space !== -1 && space < match.start) start = space + 1;
    else if (value.charCodeAt(start) >= 0xdc00 && value.charCodeAt(start) <= 0xdfff) start--;
  }
  let end = Math.min(value.length, Math.max(start + 160, match.end));
  if (end < value.length) {
    const space = value.lastIndexOf(' ', end);
    if (space >= match.end) end = space;
    else if (value.charCodeAt(end) >= 0xdc00 && value.charCodeAt(end) <= 0xdfff) end++;
  }
  const text = `${start ? '…' : ''}${value.slice(start, end).trim()}${end < value.length ? '…' : ''}`;
  return {
    ...source,
    text,
    ranges: matchRanges(prepareText(text), query),
  };
}

export function searchColumnEntries(
  entries: readonly ColumnSearchEntry[],
  query: string,
  projectKey: string,
): ColumnSearchResult[] {
  const normalizedQuery = normalize(query.trim());
  const prefix = `${normalize(projectKey)}-`;
  const numberText = normalizedQuery.startsWith(prefix)
    ? normalizedQuery.slice(prefix.length)
    : normalizedQuery;
  const exactNumber = /^\d+$/.test(numberText) ? Number(numberText) : null;
  const results: ColumnSearchResult[] = [];
  for (const entry of entries) {
    const titleRanges = matchRanges(entry.title, normalizedQuery);
    const identifierRanges =
      exactNumber === null
        ? matchRanges(entry.identifier, normalizedQuery)
        : entry.issue.sequenceNumber === exactNumber
          ? [
              {
                start: normalizedQuery.startsWith(prefix)
                  ? 0
                  : entry.identifier.text.lastIndexOf('-') + 1,
                end: entry.identifier.text.length,
              },
            ]
          : [];
    let excerpt: ColumnSearchExcerpt | null = null;
    if (normalizedQuery && !titleRanges.length && !identifierRanges.length) {
      const content = entry.content.find((part) => part.value.normalized.includes(normalizedQuery));
      if (!content) continue;
      excerpt = excerptFor(
        content,
        normalizedQuery,
        content.value.normalized.indexOf(normalizedQuery),
      );
    }
    results.push({
      issue: entry.issue,
      title: entry.title.text,
      identifier: entry.identifier.text,
      titleRanges,
      identifierRanges,
      excerpt,
    });
  }
  return results;
}
