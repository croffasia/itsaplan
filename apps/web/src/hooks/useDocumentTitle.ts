'use client';

import { useEffect } from 'react';
import { APP_NAME } from '@/utils/app';

// The layers a screen's title can come from. A higher one wins while it is mounted:
// the shell names the section, the page inside it names its entity, and a side panel
// names what it shows over the page. Within a layer the latest registration wins.
const RANK = { section: 0, page: 1, panel: 2 } as const;
type TitleLayer = keyof typeof RANK;

type Entry = { title: string; rank: number };
const entries = new Set<Entry>();

let headObserver: MutationObserver | null = null;
let observedHead: HTMLHeadElement | null = null;

function apply() {
  let top: Entry | null = null;
  for (const entry of entries) if (!top || entry.rank >= top.rank) top = entry;
  const title = top?.title ?? APP_NAME;
  if (window.document.title !== title) window.document.title = title;
  // Next streams the metadata, and React can insert its <title> into the head after
  // a page has set its own; the browser shows the first one, so the title is set again.
  if (observedHead !== window.document.head) {
    headObserver?.disconnect();
    observedHead = window.document.head;
    headObserver = new window.MutationObserver(apply);
    headObserver.observe(window.document.head, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }
}

// The breadcrumb form of a title, `Project › Section`. Null while any part is
// missing, so a screen never shows a title with a hole in it.
export function titlePath(...parts: (string | false | null | undefined)[]): string | null {
  return parts.every(Boolean) ? parts.join(' › ') : null;
}

// Sets the browser tab title while the calling component is mounted. Null registers
// nothing, which leaves the title of the layer below.
export function useDocumentTitle(title: string | null, layer: TitleLayer = 'page') {
  useEffect(() => {
    if (!title) return;
    const entry = { title, rank: RANK[layer] };
    entries.add(entry);
    apply();
    return () => {
      entries.delete(entry);
      apply();
    };
  }, [title, layer]);
}
