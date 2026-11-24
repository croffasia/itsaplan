import type { CSSProperties } from 'react';
import { allowedImageStyle } from '@repo/editor';

// The node's `style` attribute holds raw CSS text; React takes the parsed form.
export function imageStyleObject(style: string | null): CSSProperties {
  const css = allowedImageStyle(style);
  if (!css) return {};
  return Object.fromEntries(
    css.split(';').flatMap((declaration) => {
      const [property, ...rest] = declaration.split(':');
      const value = rest.join(':').trim();
      if (!property?.trim() || !value) return [];
      const camelCased = property
        .trim()
        .replaceAll(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      return [[camelCased, value]];
    }),
  );
}
