'use client';

import { useEffect, useRef } from 'react';
import { useMessageScroller } from '@/components/ui/message-scroller';

// Jumps the transcript to the newest message once, on the first render that has
// messages. Renders nothing.
export default function InitialScrollToEnd({ hasMessages }: { hasMessages: boolean }) {
  const { scrollToEnd } = useMessageScroller();
  const hasScrolled = useRef(false);

  useEffect(() => {
    if (!hasMessages || hasScrolled.current) return;

    const frame = window.requestAnimationFrame(() => {
      scrollToEnd({ behavior: 'auto' });
      hasScrolled.current = true;
    });

    return () => window.cancelAnimationFrame(frame);
  }, [hasMessages, scrollToEnd]);

  return null;
}
