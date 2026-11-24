import { describe, it, expect } from 'bun:test';
import { attachmentLink, resolveAttachmentLinks } from '../../inline-attachments';

describe('resolveAttachmentLinks', () => {
  const paths = new Map([
    ['10001', '/media/attachments/a/raw'],
    ['issue 1 https://x/y z', '/media/attachments/b/raw'],
  ]);
  const resolve = (text: string) => resolveAttachmentLinks(text, (id) => paths.get(id));

  it('points an image and a link at the stored file', () => {
    const text = `![shot.png](${attachmentLink('10001')}) and [report](${attachmentLink('10001')})`;
    expect(resolve(text)).toBe(
      '![shot.png](/media/attachments/a/raw) and [report](/media/attachments/a/raw)',
    );
  });

  it('round-trips a source id with spaces and slashes', () => {
    expect(resolve(`![x](${attachmentLink('issue 1 https://x/y z')})`)).toBe(
      '![x](/media/attachments/b/raw)',
    );
  });

  it('reads a label with an escaped bracket', () => {
    expect(resolve(`![a\\]b.png](${attachmentLink('10001')})`)).toBe(
      '![a\\]b.png](/media/attachments/a/raw)',
    );
  });

  it('keeps the text of a file that was not stored', () => {
    expect(resolve(`see ![big.mov](${attachmentLink('missing')}) here`)).toBe('see big.mov here');
  });

  it('leaves text without links as it is', () => {
    expect(resolve('![a](https://example.com/a.png)')).toBe('![a](https://example.com/a.png)');
  });
});
