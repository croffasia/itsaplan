import { describe, expect, it } from 'bun:test';
import { parseLinkMetadata } from '../../metadata';

describe('parseLinkMetadata', () => {
  it('prefers Open Graph metadata and resolves relative images', () => {
    expect(
      parseLinkMetadata(
        `
      <title>Document title</title>
      <meta name="description" content="Document description">
      <meta property="og:title" content="Open &amp; Graph">
      <meta property="og:description" content="A public page">
      <meta property="og:image" content="/photo.png?one=1&amp;two=2">
      <meta property="og:site_name" content="Example">
    `,
        'https://example.com/article',
      ),
    ).toEqual({
      url: 'https://example.com/article',
      title: 'Open & Graph',
      description: 'A public page',
      image: 'https://example.com/photo.png?one=1&two=2',
      siteName: 'Example',
    });
  });

  it('falls back to title and description, including named and numeric entities', () => {
    expect(
      parseLinkMetadata(
        '<title> A &copy; &#x1F30F; &#169; </title><meta name="DESCRIPTION" content=" two\n lines ">',
        'https://example.com',
      ),
    ).toMatchObject({
      title: 'A © 🌏 ©',
      description: 'two lines',
      image: null,
    });
  });

  it('supports Twitter metadata and keeps the first duplicate', () => {
    expect(
      parseLinkMetadata(
        '<meta name="twitter:title" content="First"><meta name="twitter:title" content="Second">',
        'https://example.com',
      ).title,
    ).toBe('First');
  });

  it('ignores fake metadata inside scripts and comments', () => {
    expect(
      parseLinkMetadata(
        '<script>"<meta property=og:title content=Fake>"</script><!-- <title>Fake</title> -->',
        'https://example.com',
      ).title,
    ).toBeNull();
  });

  it('rejects image schemes and embedded credentials', () => {
    for (const image of [
      'javascript:alert(1)',
      'data:image/png;base64,AA',
      'https://user:secret@example.com/image',
    ]) {
      expect(
        parseLinkMetadata(`<meta property="og:image" content="${image}">`, 'https://example.com')
          .image,
      ).toBeNull();
    }
  });

  it('bounds text and ignores document base URLs', () => {
    expect(
      parseLinkMetadata(
        `<base href="http://localhost/"><meta property="og:title" content="${'x'.repeat(1000)}"><meta property="og:image" content="relative.png">`,
        'https://example.com/',
      ),
    ).toMatchObject({
      title: 'x'.repeat(300),
      image: 'https://example.com/relative.png',
    });
  });

  it('returns empty fields for a page without metadata', () => {
    expect(parseLinkMetadata('<html><body>Content</body></html>', 'https://example.com')).toEqual({
      url: 'https://example.com',
      title: null,
      description: null,
      image: null,
      siteName: null,
    });
  });
});
