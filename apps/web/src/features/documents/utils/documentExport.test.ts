import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import JSZip from 'jszip';
import {
  createPortableDocumentExport,
  DocumentExportLimitError,
  documentExportArchiveFilename,
  documentExportBody,
  documentExportFilename,
  MAX_DOCUMENT_EXPORT_ASSETS,
  MAX_DOCUMENT_EXPORT_BYTES,
} from './documentExport';

const protectedAsset =
  '/protected-media/projects/SEKTA/documents/42/assets/123e4567-e89b-12d3-a456-426614174000/raw';

function assertSanitizedHtml(html: string): void {
  const normalized = html.toLowerCase();
  assert.equal(normalized.includes('<script'), false);
  assert.equal(normalized.includes('javascript:'), false);
  assert.equal(normalized.includes('onerror='), false);
  assert.equal(normalized.includes('onload='), false);
}

describe('document export', () => {
  it('creates a stable filename for either format', () => {
    assert.equal(
      documentExportFilename(' Release notes 2026 ', 'markdown'),
      'release-notes-2026.md',
    );
    assert.equal(documentExportFilename('', 'html'), 'untitled.html');
    assert.equal(documentExportArchiveFilename('Release notes 2026'), 'release-notes-2026.zip');
  });

  it('includes the page title in markdown exports', () => {
    assert.equal(documentExportBody('Guide', 'Start here.', 'markdown'), '# Guide\n\nStart here.');
  });

  it('escapes the title and sanitizes exported HTML', () => {
    const html = documentExportBody(
      '<Guide>',
      '<SCRIPT>alert(1)</SCRIPT><img src="x" onerror="alert(2)"><a href="JaVaScRiPt:alert(3)">Unsafe</a><svg onload="alert(4)"></svg>Safe',
      'html',
    );
    assert.match(html, /<h1>&lt;Guide&gt;<\/h1>/);
    assertSanitizedHtml(html);
    assert.match(html, /Safe/);
  });

  it('preserves rich editor alignment and highlight while removing scripts', () => {
    const html = documentExportBody(
      'Guide',
      'Fallback',
      'html',
      '<p style="text-align: center"><mark data-color="#fde047" style="background-color: #fde047">Important</mark><ScRiPt>alert(1)</ScRiPt><img src="x" onerror="alert(2)"></p>',
    );
    assert.match(html, /text-align: center/);
    assert.match(html, /background-color: #fde047/);
    assert.match(html, /Important/);
    assertSanitizedHtml(html);
  });

  it('inlines only this document protected assets in portable HTML', async () => {
    const calls: Array<{ url: string; credentials: RequestCredentials | undefined }> = [];
    const result = await createPortableDocumentExport({
      title: 'Guide',
      content: '',
      richHtml: `<p><img src="${protectedAsset}"><a href="${protectedAsset}">Download</a><img src="/protected-media/projects/SEKTA/documents/99/assets/123e4567-e89b-12d3-a456-426614174000/raw"><img src="https://evil.example${protectedAsset}"><a href="https://example.test/public.png">External</a></p>`,
      format: 'html',
      projectKey: 'SEKTA',
      documentId: 42,
      baseUrl: 'https://plan.example.test',
      fetchImpl: async (input, init) => {
        calls.push({ url: String(input), credentials: init?.credentials });
        return new Response(new Uint8Array([137, 80, 78, 71]), {
          headers: {
            'content-type': 'image/png',
            'content-disposition': 'inline; filename="diagram.png"',
          },
        });
      },
    });

    const html = await result.blob.text();
    assert.equal(result.filename, 'guide.html');
    assert.deepEqual(calls, [
      {
        url: `https://plan.example.test${protectedAsset}`,
        credentials: 'same-origin',
      },
    ]);
    assert.equal(html.match(/data:image\/png;base64,iVBORw==/g)?.length, 2);
    assert.match(html, /documents\/99\/assets\/123e4567/);
    assert.match(html, /https:\/\/evil\.example\/protected-media\/projects\/SEKTA/);
    assert.match(html, /https:\/\/example\.test\/public\.png/);
  });

  it('does not preserve active asset MIME types in portable HTML', async () => {
    const result = await createPortableDocumentExport({
      title: 'Guide',
      content: '',
      richHtml: `<a href="${protectedAsset}">Download diagram</a>`,
      format: 'html',
      projectKey: 'SEKTA',
      documentId: 42,
      baseUrl: 'https://plan.example.test',
      fetchImpl: async () =>
        new Response('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', {
          headers: { 'content-type': 'image/svg+xml' },
        }),
    });

    const html = await result.blob.text();
    assert.equal(html.includes('data:image/svg+xml'), false);
    assert.match(html, /data:application\/octet-stream;base64,/);
  });

  it('packages Markdown with local protected assets and preserves external links', async () => {
    let calls = 0;
    const result = await createPortableDocumentExport({
      title: 'Guide',
      content: `![Diagram](${protectedAsset})\n\n[Download](${protectedAsset})\n\n[External](https://example.test/public.pdf)`,
      format: 'markdown',
      projectKey: 'SEKTA',
      documentId: 42,
      baseUrl: 'https://plan.example.test',
      fetchImpl: async () => {
        calls += 1;
        return new Response(new Uint8Array([1, 2, 3]), {
          headers: {
            'content-type': 'image/png',
            'content-disposition': "attachment; filename*=UTF-8''diagram.png",
          },
        });
      },
    });

    assert.equal(result.filename, 'guide.zip');
    assert.equal(calls, 1);
    const zip = await JSZip.loadAsync(await result.blob.arrayBuffer());
    const markdown = await zip.file('guide.md')!.async('string');
    assert.equal(markdown.match(/assets\/diagram\.png/g)?.length, 2);
    assert.match(markdown, /https:\/\/example\.test\/public\.pdf/);
    assert.deepEqual([...(await zip.file('assets/diagram.png')!.async('uint8array'))], [1, 2, 3]);
  });

  it('downloads Markdown without protected assets as a plain .md file', async () => {
    let calls = 0;
    const result = await createPortableDocumentExport({
      title: 'Guide',
      content: '[External](https://example.test/public.pdf)',
      format: 'markdown',
      projectKey: 'SEKTA',
      documentId: 42,
      baseUrl: 'https://plan.example.test',
      fetchImpl: async () => {
        calls += 1;
        throw new Error('External assets must not be fetched');
      },
    });

    assert.equal(result.filename, 'guide.md');
    assert.equal(result.blob.type, 'text/markdown;charset=utf-8');
    assert.equal(calls, 0);
    assert.equal(
      await result.blob.text(),
      '# Guide\n\n[External](https://example.test/public.pdf)',
    );
  });

  it('rejects exports with more protected assets than the hard cap before fetching', async () => {
    let calls = 0;
    const content = Array.from({ length: MAX_DOCUMENT_EXPORT_ASSETS + 1 }, (_, index) => {
      const publicId = `123e4567-e89b-12d3-a456-${index.toString(16).padStart(12, '0')}`;
      return `![Asset ${index}](/protected-media/projects/SEKTA/documents/42/assets/${publicId}/raw)`;
    }).join('\n');

    await assert.rejects(
      createPortableDocumentExport({
        title: 'Guide',
        content,
        format: 'markdown',
        projectKey: 'SEKTA',
        documentId: 42,
        baseUrl: 'https://plan.example.test',
        fetchImpl: async () => {
          calls += 1;
          return new Response();
        },
      }),
      DocumentExportLimitError,
    );
    assert.equal(calls, 0);
  });

  it('rejects a declared protected asset size beyond the total byte cap', async () => {
    await assert.rejects(
      createPortableDocumentExport({
        title: 'Guide',
        content: `![Diagram](${protectedAsset})`,
        format: 'markdown',
        projectKey: 'SEKTA',
        documentId: 42,
        baseUrl: 'https://plan.example.test',
        fetchImpl: async () =>
          new Response(new Uint8Array([1]), {
            headers: { 'content-length': String(MAX_DOCUMENT_EXPORT_BYTES + 1) },
          }),
      }),
      DocumentExportLimitError,
    );
  });
});
