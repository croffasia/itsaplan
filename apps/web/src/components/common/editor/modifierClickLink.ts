const OPENABLE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);

export function openLinkOnModifierClick(event: MouseEvent, root: HTMLElement): boolean {
  if (event.button !== 0 || (!event.metaKey && !event.ctrlKey)) return false;
  const target = event.target as Element | null;
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
