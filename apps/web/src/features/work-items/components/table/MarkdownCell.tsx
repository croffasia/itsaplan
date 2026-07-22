import { useEffect, useMemo, useRef } from 'react';
import { renderMarkdown } from '@/lib/markdown';

// Natural pixel size of each image URL, filled the first time the image loads.
// Markdown images carry no width/height, so their height is only known after the
// file loads. In a virtualized list that changing height makes the row grow after
// mount, which shifts the layout, which remounts rows, which reloads the images —
// a jitter loop. Setting each image's width/height from this cache (paired with
// the `.md-content img { height:auto }` rule) reserves its height from the aspect
// ratio before it loads, so the row height stays stable across remounts.
const imageDims = new Map<string, { w: number; h: number }>();

// A markdown custom-field cell. Renders the formatted markdown and reserves image
// heights (see imageDims) so the virtualized table does not jitter as images load.
export function MarkdownCell({ value }: { value: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const html = useMemo(() => renderMarkdown(value), [value]);

  useEffect(() => {
    const imgs = ref.current?.querySelectorAll('img');
    if (!imgs) return;
    const cleanups: (() => void)[] = [];
    imgs.forEach((img) => {
      const reserve = (w: number, h: number) => {
        if (w > 0 && h > 0) {
          img.setAttribute('width', String(w));
          img.setAttribute('height', String(h));
        }
      };
      const cached = imageDims.get(img.src);
      if (cached) {
        reserve(cached.w, cached.h);
      } else if (img.complete && img.naturalWidth > 0) {
        imageDims.set(img.src, { w: img.naturalWidth, h: img.naturalHeight });
        reserve(img.naturalWidth, img.naturalHeight);
      } else {
        const onLoad = () => {
          if (img.naturalWidth > 0) {
            imageDims.set(img.src, { w: img.naturalWidth, h: img.naturalHeight });
            reserve(img.naturalWidth, img.naturalHeight);
          }
        };
        img.addEventListener('load', onLoad);
        cleanups.push(() => img.removeEventListener('load', onLoad));
      }
    });
    return () => cleanups.forEach((fn) => fn());
  }, [html]);

  return (
    <div ref={ref} className="md-content text-xs" dangerouslySetInnerHTML={{ __html: html }} />
  );
}
