import { processPdfAsync } from '@firecrawl/pdf-inspector';
import { pinnedFetch, ResponseTooLargeError, UrlNotAllowedError } from '@repo/net';
import { z } from 'zod';
import type { CustomToolEntry } from '../../types';

const MAX_MB = 50;
const MAX_REDIRECTS = 5;
// A long PDF renders to far more than the ~25k tokens a model still reads reliably in
// one result. The bound is in characters because there is no tokenizer here: Cyrillic
// markdown runs about 2.5 characters per token, so 60,000 stays inside the budget.
const MAX_CHARS = 60_000;
const AROUND_CHARS = 1_000;

// The text from `offset` up to the bound, cut at the last line break before it so a
// part does not end mid-line. nextOffset is null once the text is read to the end.
export function part(markdown: string, offset: number) {
  const rest = markdown.slice(offset);
  if (rest.length <= MAX_CHARS) return { markdown: rest, nextOffset: null };
  const head = rest.slice(0, MAX_CHARS);
  const lastBreak = head.lastIndexOf('\n');
  const text = lastBreak > 0 ? head.slice(0, lastBreak) : head;
  return { markdown: text, nextOffset: offset + text.length };
}

// The passage around each match of `query` from `offset` on: AROUND_CHARS before and
// after it. A match inside the previous passage is shown by it, so passages never
// overlap. Spaces in the query match any whitespace, since a PDF breaks lines inside
// a phrase. nextOffset continues the search once the passages reach the bound.
export function search(markdown: string, query: string, offset: number) {
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(escaped.replace(/\s+/g, '\\s+'), 'gi');
  pattern.lastIndex = offset;
  const passages: { offset: number; text: string }[] = [];
  let from = offset;
  let size = 0;
  for (let match; (match = pattern.exec(markdown));) {
    const start = Math.max(from, match.index - AROUND_CHARS);
    const end = Math.min(markdown.length, match.index + match[0].length + AROUND_CHARS);
    if (size + end - start > MAX_CHARS) return { passages, nextOffset: start };
    passages.push({ offset: start, text: markdown.slice(start, end) });
    size += end - start;
    from = end;
    pattern.lastIndex = end;
  }
  return { passages, nextOffset: null };
}

// Each hop goes through the SSRF guard again, so a redirect cannot lead to an address
// the first check never saw.
async function download(url: string): Promise<Buffer> {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let res: Response;
    try {
      res = await pinnedFetch(current, {
        publicOnly: true,
        timeoutMs: 30_000,
        maxBytes: MAX_MB * 1024 * 1024,
      });
    } catch (err) {
      if (err instanceof UrlNotAllowedError)
        throw new Error(`Cannot fetch ${current}: ${err.message}.`);
      if (err instanceof ResponseTooLargeError)
        throw new Error(`The PDF is larger than ${MAX_MB} MB.`);
      throw new Error(`Could not fetch ${current}.`);
    }
    const location = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && location) {
      current = new URL(location, current).toString();
      continue;
    }
    if (!res.ok) throw new Error(`Could not fetch ${current} (status ${res.status}).`);
    return Buffer.from(await res.arrayBuffer());
  }
  throw new Error(`${url} redirects more than ${MAX_REDIRECTS} times.`);
}

export const pdfRead: CustomToolEntry = {
  key: 'pdf_read',
  label: 'Read PDF',
  description:
    'Download a PDF from a public URL and return its text as Markdown, with its title and page count. A long PDF comes back in parts: while nextOffset is not null, call again with it as offset to read the next part. With a query, returns only the passages around each match, each with its offset; to read on from a passage, call again with its offset and no query. A scanned PDF has no text layer and cannot be read.',
  inputSchema: z.object({
    url: z.string().url().describe('The http(s) URL of the PDF.'),
    query: z
      .string()
      .min(1)
      .max(200)
      .optional()
      .describe(
        'Text to find, case-insensitive. Returns the passages around it, not the whole text.',
      ),
    offset: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe('The nextOffset of the previous call, to read or search the next part.'),
  }),
  execute: async (_credential, input) => {
    const bytes = await download(String(input.url));
    let result;
    try {
      result = await processPdfAsync(bytes);
    } catch (err) {
      throw new Error(
        `The file is not a readable PDF: ${err instanceof Error ? err.message : err}`,
      );
    }
    // The converter leaves a link for every image, and the images are not extracted.
    const markdown = (result.markdown ?? '')
      .replace(/!\[[^\]]*\]\(pdf-image:\/\/\d+\)/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    if (result.pdfType === 'Scanned' || result.pdfType === 'ImageBased' || markdown === '') {
      throw new Error('This PDF has no text layer (it is a scan or a set of images).');
    }
    const query = String(input.query ?? '').trim();
    const offset = Number(input.offset ?? 0);
    return {
      title: result.title ?? null,
      pageCount: result.pageCount,
      ...(query ? search(markdown, query, offset) : part(markdown, offset)),
    };
  },
};
