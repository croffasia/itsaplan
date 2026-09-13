export function previewableLink(target: EventTarget | null, root: HTMLElement) {
  if (!(target instanceof Element)) return null;
  const link = target.closest<HTMLAnchorElement>('a[href]');
  if (!link || !root.contains(link) || link.hasAttribute('download')) return null;
  try {
    const url = new URL(link.href);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    return link;
  } catch {
    return null;
  }
}
