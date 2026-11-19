import { describe, it, expect } from 'bun:test';
import {
  allowedImageStyle,
  documentColor,
  isAllowedImageStyle,
  isSafeDocumentImageSource,
  isSafeLinkHref,
} from '../rules';

describe('allowedImageStyle', () => {
  it('drops every declaration that could lay the image over the page', () => {
    expect(allowedImageStyle('position:fixed;inset:0;width:100vw;height:100vh;z-index:9999')).toBe(
      null,
    );
    expect(allowedImageStyle('position: absolute; top: 0; left: 0; opacity: 0')).toBe(null);
  });

  it('keeps only the sizing next to a hostile declaration', () => {
    expect(allowedImageStyle('position:fixed;inset:0;width:320px;height:100vh;z-index:9999')).toBe(
      'width: 320px',
    );
  });

  it('keeps a width and max-width', () => {
    expect(allowedImageStyle('width: 320px; max-width: 100%')).toBe(
      'width: 320px; max-width: 100%',
    );
    expect(allowedImageStyle('max-width:50%')).toBe('max-width: 50%');
    expect(allowedImageStyle('WIDTH: AUTO;')).toBe('width: auto');
  });

  it('rejects sizing values that are not a plain length', () => {
    for (const css of [
      'width: 100vw',
      'width: calc(100vw + 1px)',
      'width: 320px !important',
      'max-width: 500%',
      'width: 99999px',
      'width: expression(alert(1))',
    ])
      expect(allowedImageStyle(css)).toBe(null);
  });

  it('does not throw on malformed style text', () => {
    for (const css of ['', ';;;', 'width', ':', 'width:', ':320px', 'a:b:c;;width::1', null])
      expect(allowedImageStyle(css)).toBe(null);
  });
});

describe('isAllowedImageStyle', () => {
  it('accepts what allowedImageStyle keeps, and the max-width the api always took', () => {
    expect(isAllowedImageStyle('width: 120px')).toBe(true);
    expect(isAllowedImageStyle('max-width:50%;')).toBe(true);
    expect(isAllowedImageStyle('width: 120px; height: 10px')).toBe(false);
    expect(isAllowedImageStyle('')).toBe(false);
  });
});

describe('documentColor', () => {
  it('keeps hex and reads the rgb() a browser writes back as hex', () => {
    expect(documentColor('#ff0000')).toBe('#ff0000');
    expect(documentColor('#0f0')).toBe('#0f0');
    expect(documentColor('rgb(255, 0, 0)')).toBe('#ff0000');
    expect(documentColor(' rgba(0, 128, 255, 0.5) ')).toBe('#0080ff80');
  });

  it('drops a colour it cannot store', () => {
    for (const value of ['red', 'rgb(300, 0, 0)', 'hsl(0, 100%, 50%)', 'var(--x)', '', null])
      expect(documentColor(value)).toBe(null);
  });
});

describe('isSafeDocumentImageSource', () => {
  it('takes web URLs and the page uploads only', () => {
    expect(isSafeDocumentImageSource('https://img.example.com/a.png')).toBe(true);
    expect(
      isSafeDocumentImageSource(
        '/protected-media/projects/DQA/documents/24/assets/0a0b0c0d-0e0f-4a1b-8c2d-3e4f5a6b7c8d/raw',
      ),
    ).toBe(true);
    for (const src of ['/media/x.png', 'x', 'javascript:alert(1)', 'https://user:pw@x.y/a.png'])
      expect(isSafeDocumentImageSource(src)).toBe(false);
  });
});

describe('isSafeLinkHref', () => {
  it('takes web, mail and phone links, paths and anchors', () => {
    for (const href of ['https://x.y', '/p/x', '#top', 'mailto:a@b.co', 'tel:+1555'])
      expect(isSafeLinkHref(href)).toBe(true);
    for (const href of ['javascript:alert(1)', '//x.y', 'mailto:', 'ftp://x.y', 'https://x.y/a b'])
      expect(isSafeLinkHref(href)).toBe(false);
  });
});
