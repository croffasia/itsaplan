import DOMPurify from 'isomorphic-dompurify';
import type { ClipboardEvent } from 'react';
import { previewUrl } from './linkPresentation';
import type { LinkPreviewItem } from './LinkPreviewDialog';

export type StaticLinkBlock = { html: string; links: LinkPreviewItem[]; bare: boolean };

export function staticLinkBlocks(html: string, bareUrls: ReadonlySet<string>, origin: string) {
  const fragment = DOMPurify.sanitize(html, { RETURN_DOM_FRAGMENT: true });
  return Array.from(fragment.childNodes).map((node): StaticLinkBlock => {
    if (node.nodeType !== 1) {
      const wrapper = fragment.ownerDocument.createElement('span');
      wrapper.textContent = node.textContent;
      return { html: wrapper.innerHTML, links: [], bare: false };
    }
    const element = node as Element;
    const links = Array.from(element.querySelectorAll<HTMLAnchorElement>('a[href]'))
      .filter(
        (link) =>
          !link.hasAttribute('download') &&
          !link.closest('code, pre, table, [data-mention]') &&
          !link.querySelector('img') &&
          previewUrl(link.getAttribute('href')!, origin),
      )
      .map((link) => ({ url: link.getAttribute('href')!, label: link.textContent ?? '' }));
    return {
      html: element.outerHTML,
      links,
      bare:
        element.tagName === 'P' &&
        links.length === 1 &&
        element.textContent?.trim() === links[0].url &&
        bareUrls.has(links[0].url) &&
        Array.from(element.childNodes).every(
          (child) =>
            (child.nodeType === 3 && !child.textContent?.trim()) ||
            (child.nodeType === 1 && (child as Element).tagName === 'A'),
        ),
    };
  });
}

export function copyPresentedLinks(event: ClipboardEvent<HTMLElement>) {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || !selection.rangeCount) return;
  const fragment = selection.getRangeAt(0).cloneContents();
  if (!fragment.querySelector('[data-link-presentation]')) return;
  for (const source of fragment.querySelectorAll('[data-link-original]')) source.remove();
  for (const control of fragment.querySelectorAll('[data-link-preview-control]')) control.remove();
  for (const link of fragment.querySelectorAll('[data-link-row]'))
    link.textContent = link.getAttribute('data-link-row');
  const wrapper = document.createElement('div');
  wrapper.append(fragment);
  event.preventDefault();
  event.clipboardData.setData('text/plain', wrapper.textContent ?? '');
  event.clipboardData.setData('text/html', wrapper.innerHTML);
}
