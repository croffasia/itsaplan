import type { Editor } from '@tiptap/core';
import type { Mark } from '@tiptap/pm/model';
import { shareDocumentPath } from '@/utils/paths';

// Links inside a publicly shared document. A link to one of the pages the share opens is
// pointed at the share itself, so a reader stays under the token instead of hitting the
// login. Any other link into the app needs a session: it keeps its address, for members
// who can sign in, and is marked as locked so a reader is not surprised by the login.

export const LOCKED_LINK_CLASS = 'share-link-locked';

const DOCUMENT_PATH = /^\/[^/]+\/[^/]+\/docs\/([1-9]\d*)\/?$/;
// Routes that already work without a session.
const PUBLIC_PREFIXES = ['/share/', '/media/'];

export type SharedLinkTarget = { pageId: number } | 'locked' | null;

// What a link in a shared page leads to: one of the shared pages, an app page behind
// the login, or (null) somewhere outside the app that is left as it is.
export function sharedLinkTarget(
  href: string,
  origin: string,
  pageIds: ReadonlySet<number>,
): SharedLinkTarget {
  let url: URL;
  try {
    url = new URL(href, origin);
  } catch {
    return null;
  }
  if (url.origin !== origin) return null;
  if (PUBLIC_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) return null;
  const match = DOCUMENT_PATH.exec(url.pathname);
  if (match && pageIds.has(Number(match[1]))) return { pageId: Number(match[1]) };
  return 'locked';
}

// The address of one page of a shared document. The shared page itself has none of its
// own: it is the share link.
export function sharedPageHref(token: string, pageId: number, rootId: number): string {
  const path = shareDocumentPath(token);
  return pageId === rootId ? path : `${path}?page=${pageId}`;
}

// The page a share address opens: the shared page (null) or the one in `?page`, or
// undefined when the address is not this share.
export function sharedPageOf(
  href: string,
  origin: string,
  token: string,
): number | null | undefined {
  let url: URL;
  try {
    url = new URL(href, origin);
  } catch {
    return undefined;
  }
  if (url.origin !== origin || url.pathname !== shareDocumentPath(token)) return undefined;
  return parsePageParam(url.searchParams.get('page'));
}

export function parsePageParam(value: string | null): number | null {
  return value && /^[1-9]\d*$/.test(value) ? Number(value) : null;
}

// Rewrites the links of a read-only shared page in place, without touching its history.
export function rewriteSharedLinks(
  editor: Editor,
  share: { token: string; origin: string; rootId: number; pageIds: ReadonlySet<number> },
  lockedTitle: string,
): void {
  const linkType = editor.schema.marks.link;
  if (!linkType || editor.isDestroyed) return;
  const { tr } = editor.state;
  editor.state.doc.descendants((node, pos) => {
    if (!node.isText) return;
    const link = node.marks.find((mark: Mark) => mark.type === linkType);
    const href = link?.attrs.href;
    if (!link || typeof href !== 'string') return;
    const target = sharedLinkTarget(href, share.origin, share.pageIds);
    if (!target) return;
    const attrs =
      target === 'locked'
        ? { ...link.attrs, class: LOCKED_LINK_CLASS, title: lockedTitle }
        : {
            ...link.attrs,
            href: sharedPageHref(share.token, target.pageId, share.rootId),
            target: null,
          };
    const end = pos + node.nodeSize;
    tr.removeMark(pos, end, linkType).addMark(pos, end, linkType.create(attrs));
  });
  if (!tr.docChanged) return;
  tr.setMeta('addToHistory', false);
  editor.view.dispatch(tr);
}
