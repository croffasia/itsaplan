import { describe, it, expect } from 'bun:test';
import { stripPdfImagePlaceholders } from '../../pdf';

describe('pdf image placeholders', () => {
  it('drops the placeholders and the blank lines they leave behind', () => {
    const markdown = [
      '# Report',
      '',
      '![image](pdf-image://0)',
      '',
      'The first paragraph.',
      '',
      '![](pdf-image://12)',
      '',
      'The last paragraph.',
    ].join('\n');
    expect(stripPdfImagePlaceholders(markdown)).toBe(
      '# Report\n\nThe first paragraph.\n\nThe last paragraph.',
    );
  });

  it('leaves a real image link alone', () => {
    const markdown = '![chart](https://example.com/chart.png)';
    expect(stripPdfImagePlaceholders(markdown)).toBe(markdown);
  });
});
