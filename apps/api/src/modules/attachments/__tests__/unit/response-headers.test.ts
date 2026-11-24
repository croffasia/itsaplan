import { describe, it, expect } from 'bun:test';
import { attachmentResponseHeaders } from '../../storage';

function headersFor(contentType: string) {
  return attachmentResponseHeaders({ contentType, filename: 'f', etag: '"e"', download: false });
}

// Rows stored before uploads were checked for a single media type can still hold one
// that a browser reads as HTML.
describe('attachment response headers', () => {
  it('forces a download for a stored type that carries a second type', () => {
    const headers = headersFor('image/png, text/html');
    expect(headers['Content-Disposition']).toStartWith('attachment');
    expect(headers['Content-Security-Policy']).toContain('sandbox');
  });

  it('serves an inline file with its bare media type', () => {
    const headers = headersFor('image/png;x=,text/html');
    expect(headers['Content-Disposition']).toStartWith('inline');
    expect(headers['Content-Type']).toBe('image/png');
  });
});
