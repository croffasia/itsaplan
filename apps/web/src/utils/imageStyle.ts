// An image's inline style is applied for every reader of the text that carries
// it, so only its sizing survives: any other declaration (position, inset,
// z-index) could lay the image over the whole page.
const ALLOWED_PROPERTIES = new Set(['width', 'max-width']);

// A pixel or percentage length, capped like the API's image width, or `auto`.
const LENGTH = /^(?:auto|[1-9]\d{0,3}px|(?:100|[1-9]\d?)%)$/;

export function allowedImageStyle(css: string | null | undefined): string | null {
  if (!css) return null;
  const kept = css.split(';').flatMap((declaration) => {
    const colon = declaration.indexOf(':');
    if (colon === -1) return [];
    const property = declaration.slice(0, colon).trim().toLowerCase();
    const value = declaration
      .slice(colon + 1)
      .trim()
      .toLowerCase();
    return ALLOWED_PROPERTIES.has(property) && LENGTH.test(value) ? [`${property}: ${value}`] : [];
  });
  return kept.length > 0 ? kept.join('; ') : null;
}
