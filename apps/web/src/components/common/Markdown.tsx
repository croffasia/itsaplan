'use client';

import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { markdownSegments } from '@/lib/markdown';
import { Skeleton } from '@/components/ui/skeleton';
import MarkdownLinkContent from './editor/MarkdownLinkContent';
import { bareMarkdownUrls } from './editor/linkPresentation';

// recharts is loaded only by the answers that actually carry a chart, so the views
// that just show markdown do not pull it in.
const ChartBlock = dynamic(() => import('./chart/ChartBlock'));
// The import review card pulls its draft over HTTP, so only answers carrying one
// load it.
const AgentChatImportCard = dynamic(() => import('./agent-chat/AgentChatImportCard'));

// Renders markdown text as formatted HTML with the shared `.md-content` styles
// (headings, lists, code, blockquote, links), without the virtualized-table image
// sizing the markdown table cell adds. Links open in a new tab so following one
// does not replace the view the reader was on. A ```chart fence is drawn as a chart
// where it sits in the text (see markdownSegments).
export default function Markdown({
  children,
  complete = true,
}: {
  children: string;
  complete?: boolean;
}) {
  const segments = useMemo(() => markdownSegments(children, { newTabLinks: true }), [children]);
  const bareUrls = useMemo(
    () => (complete ? bareMarkdownUrls(children) : new Set<string>()),
    [children, complete],
  );
  // `dir="auto"` reads the direction from the text itself, so an Arabic comment in
  // an English interface — and the reverse — is laid out the way it was written.
  return (
    <div dir="auto">
      {segments.map((segment, index) => {
        if (segment.kind === 'chart') {
          return <ChartBlock key={index} spec={segment.spec} source={segment.source} />;
        }
        if (segment.kind === 'issue-import') {
          return <AgentChatImportCard key={index} importId={segment.importId} />;
        }
        // The fence is still streaming in: hold its place rather than showing the
        // half-written JSON that would turn into the chart a moment later.
        if (segment.kind === 'pending') {
          return <Skeleton key={index} className="my-3 h-[220px] w-full" />;
        }
        return (
          <MarkdownLinkContent
            key={index}
            html={segment.html}
            bareUrls={bareUrls}
            complete={complete}
          />
        );
      })}
    </div>
  );
}
