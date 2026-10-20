'use client';

import { useDocumentTitle } from '@/hooks/useDocumentTitle';

// The tab title of a server-rendered page, which cannot call the hook itself.
export default function DocumentTitle({ title }: { title: string }) {
  useDocumentTitle(title);
  return null;
}
