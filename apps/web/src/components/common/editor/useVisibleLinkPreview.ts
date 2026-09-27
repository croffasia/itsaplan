import { useEffect, useRef, useState } from 'react';
import { useLinkPreviewQuery } from './useLinkPreviewQuery';

export function useVisibleLinkPreview(url: string | undefined) {
  const ref = useRef<HTMLSpanElement>(null);
  const [visibleUrl, setVisibleUrl] = useState<string>();

  useEffect(() => {
    const element = ref.current;
    if (!url || !element || typeof IntersectionObserver === 'undefined') return;
    let active = true;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!active) return;
        const entry = entries.at(-1);
        const visible =
          entry?.isIntersecting &&
          entry.intersectionRect.width > 0 &&
          entry.intersectionRect.height > 0 &&
          getComputedStyle(element).visibility !== 'hidden';
        setVisibleUrl(visible ? url : undefined);
      },
      { rootMargin: '0px', threshold: [0, 0.01] },
    );
    observer.observe(element);
    return () => {
      active = false;
      observer.disconnect();
      setVisibleUrl(undefined);
    };
  }, [url]);

  const { data: preview } = useLinkPreviewQuery(url === visibleUrl ? url : undefined);
  return { ref, preview };
}
