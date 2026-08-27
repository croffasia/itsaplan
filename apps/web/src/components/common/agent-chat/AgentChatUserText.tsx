'use client';

import type { ReactNode } from 'react';
import { FILE_MARKER, fileMarkerUrl } from '@/lib/markdown';

// The user bubble shows plain text, except the marker an attached file arrives
// as, which renders as the file name with a download link (see lib/markdown.ts).
export default function AgentChatUserText({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(new RegExp(FILE_MARKER))) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    parts.push(
      <a
        key={parts.length}
        href={fileMarkerUrl(match[2])}
        target="_blank"
        rel="noreferrer"
        className="underline underline-offset-2"
      >
        {match[1]}
      </a>,
    );
    last = match.index + match[0].length;
  }
  parts.push(text.slice(last));
  return <span className="whitespace-pre-wrap">{parts}</span>;
}
