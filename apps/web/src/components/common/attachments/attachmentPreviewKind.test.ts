import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { attachmentPreviewKind, exceedsPreviewLimit } from './attachmentPreviewKind';

const kind = (filename: string, contentType = 'application/octet-stream') =>
  attachmentPreviewKind({ url: '/media/attachments/abc/raw', filename, contentType });

describe('attachmentPreviewKind', () => {
  it('reads the kind from the content type', () => {
    assert.equal(kind('photo', 'image/png'), 'image');
    assert.equal(kind('clip', 'video/mp4'), 'video');
    assert.equal(kind('report', 'application/pdf'), 'pdf');
    assert.equal(kind('notes', 'text/plain; charset=utf-8'), 'text');
  });

  it('falls back to the extension when the browser sent no useful type', () => {
    assert.equal(kind('Report.PDF'), 'pdf');
    assert.equal(kind('spec.docx'), 'docx');
    assert.equal(kind('budget.xlsx'), 'xlsx');
    assert.equal(kind('deck.pptx'), 'pptx');
    assert.equal(kind('README.md'), 'markdown');
    assert.equal(kind('main.ts'), 'text');
  });

  // Windows reports a .csv as an Excel workbook, which the workbook viewer cannot open.
  it('prefers the extension over the content type', () => {
    assert.equal(kind('export.csv', 'application/vnd.ms-excel'), 'csv');
  });

  it('reads a TypeScript file the browser reported as video as text', () => {
    assert.equal(kind('main.ts', 'video/mp2t'), 'text');
  });

  it('offers no preview for a type no viewer draws', () => {
    assert.equal(kind('backup.zip', 'application/zip'), null);
    assert.equal(kind('.gitignore'), null);
  });
});

describe('exceedsPreviewLimit', () => {
  it('caps the files parsed on the main thread and leaves the rest alone', () => {
    assert.equal(exceedsPreviewLimit('text', 1024 * 1024), false);
    assert.equal(exceedsPreviewLimit('text', 1024 * 1024 + 1), true);
    assert.equal(exceedsPreviewLimit('csv', 10 * 1024 * 1024 + 1), true);
    assert.equal(exceedsPreviewLimit('pdf', 500 * 1024 * 1024), false);
  });
});
