export interface LinkPreview {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
}

function text(value: string | undefined, limit: number): string | null {
  return value ? decodeEntities(value).replace(/\s+/g, ' ').trim().slice(0, limit) || null : null;
}

function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z\d]+);/gi, (match, entity: string) => {
    if (!entity.startsWith('#')) return decodeNamedCharacterReference(entity) || match;
    const hex = entity[1]?.toLowerCase() === 'x';
    const point = parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
    if (point === 0 || point > 0x10ffff || (point >= 0xd800 && point <= 0xdfff)) return '\ufffd';
    return String.fromCodePoint(point);
  });
}

export function parseLinkMetadata(html: string, url: string): LinkPreview {
  const metadata = new Map<string, string>();
  let title = '';
  new HTMLRewriter()
    .on('title', {
      text(chunk) {
        if (title.length < 1000) title += chunk.text;
      },
    })
    .on('meta', {
      element(element) {
        const name = (
          element.getAttribute('property') ?? element.getAttribute('name')
        )?.toLowerCase();
        const content = element.getAttribute('content');
        if (name && content && !metadata.has(name)) metadata.set(name, content);
      },
    })
    .transform(html);

  let image: string | null = null;
  const imageValue =
    metadata.get('og:image:secure_url') ??
    metadata.get('og:image') ??
    metadata.get('twitter:image');
  if (imageValue && imageValue.length <= 4096) {
    try {
      const candidate = new URL(decodeEntities(imageValue), url);
      if (
        ['http:', 'https:'].includes(candidate.protocol) &&
        !candidate.username &&
        !candidate.password
      ) {
        image = candidate.href;
      }
    } catch {
      image = null;
    }
  }

  return {
    url,
    title: text(metadata.get('og:title') ?? metadata.get('twitter:title') ?? title, 300),
    description: text(
      metadata.get('og:description') ??
        metadata.get('twitter:description') ??
        metadata.get('description'),
      600,
    ),
    image,
    siteName: text(metadata.get('og:site_name'), 100),
  };
}
import { decodeNamedCharacterReference } from 'decode-named-character-reference';
