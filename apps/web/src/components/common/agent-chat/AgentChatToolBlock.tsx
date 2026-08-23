'use client';

import { useMemo } from 'react';
import { highlight } from '@/lib/highlight';

// What a tool call was given or answered. `md-content` carries the highlighter's
// colours, the fill behind the block, and the left-to-right direction a mirrored page
// would otherwise impose on it.
export default function AgentChatToolBlock({ label, text }: { label: string; text: string }) {
  const highlighted = useMemo(() => highlight(text), [text]);

  return (
    <div className="min-w-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="md-content mt-1">
        <pre className="max-h-64 overflow-auto text-xs leading-relaxed wrap-break-word whitespace-pre-wrap">
          <code>{highlighted ?? text}</code>
        </pre>
      </div>
    </div>
  );
}
