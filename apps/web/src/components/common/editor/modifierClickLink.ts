import type { EditorView } from '@tiptap/pm/view';

const OPENABLE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);

export function openLinkOnModifierClick(
  event: MouseEvent,
  view: Pick<EditorView, 'dom' | 'editable'>,
): boolean {
  if (event.button !== 0 || (!event.metaKey && !event.ctrlKey)) return false;
  // The browser opens the link. True keeps the editor from selecting its block.
  if (!view.editable) return event.target instanceof Element && !!event.target.closest('a[href]');
  return openLink(event, view.dom);
}

export function openLinkOnAuxClick(event: MouseEvent, root: HTMLElement): boolean {
  if (event.button !== 1) return false;
  return openLink(event, root);
}

export function openLinkOnEnter(
  event: KeyboardEvent,
  root: HTMLElement,
  focusedLink: HTMLAnchorElement | null = null,
): boolean {
  if (event.key !== 'Enter' || event.target !== document.activeElement) return false;
  if (event.target === root && focusedLink) return openLink(event, root, focusedLink);
  if (!(event.target instanceof Element) || event.target.tagName !== 'A') return false;
  return openLink(event, root);
}

export function openLink(
  event: MouseEvent | KeyboardEvent,
  root: HTMLElement,
  target = event.target as Element | null,
): boolean {
  if (!target || typeof target.closest !== 'function') return false;
  const link = target.closest<HTMLAnchorElement>('a[href]');
  if (!link || !root.contains(link)) return false;

  let url: URL;
  try {
    url = new URL(link.href, window.location.href);
  } catch {
    return false;
  }
  if (!OPENABLE_PROTOCOLS.has(url.protocol)) return false;

  event.preventDefault();
  window.open(url.href, link.target || '_blank', 'noopener,noreferrer');
  return true;
}
