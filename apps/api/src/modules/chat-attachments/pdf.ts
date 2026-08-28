import { processPdfAsync } from '@firecrawl/pdf-inspector';
import { HttpError } from '#shared/lib';

// The images a PDF holds are not extracted, so the placeholders the converter
// emits for them would be links to nothing.
export function stripPdfImagePlaceholders(markdown: string): string {
  return markdown
    .replace(/!\[[^\]]*\]\(pdf-image:\/\/\d+\)/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const NO_TEXT_LAYER =
  'This PDF has no text layer (it is a scan or a set of images). ' +
  'Attach a PDF with selectable text, or a .md/.txt file instead.';

// processPdfAsync parses on the libuv thread pool, so a large document does not
// block the event loop.
export async function pdfToMarkdown(bytes: Buffer): Promise<string> {
  let result;
  try {
    result = await processPdfAsync(bytes);
  } catch (err) {
    const reason = err instanceof Error ? err.message : err;
    throw new HttpError(400, `The file is not a readable PDF: ${reason}`);
  }
  if (result.pdfType === 'Scanned' || result.pdfType === 'ImageBased') {
    throw new HttpError(400, NO_TEXT_LAYER);
  }
  const markdown = stripPdfImagePlaceholders(result.markdown ?? '');
  if (markdown === '') throw new HttpError(400, NO_TEXT_LAYER);
  return markdown;
}
