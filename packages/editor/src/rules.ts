// The values a page may hold. The api checks stored JSON against them, and the editor
// reads Markdown and HTML with them, so a page written either way stays valid.

export const TEXT_ALIGNMENTS = ['left', 'center', 'right'];

// The nodes that carry a blockId, the target of a link to one block.
export const DOCUMENT_BLOCK_TYPES = [
  'paragraph',
  'heading',
  'blockquote',
  'codeBlock',
  'bulletList',
  'orderedList',
  'taskList',
  'table',
  'horizontalRule',
  'image',
];

export const isBlockId = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(value);

// A mention is @handle: a member's username, or an agent's. A handle holds letters,
// digits and . _ -, and never ends on . or -, so a mention that closes a sentence keeps
// the punctuation out of it. The lookbehind keeps an email address (name@example.com)
// and a doubled @ from reading as one.
const HANDLE = '[a-zA-Z0-9_](?:[a-zA-Z0-9._-]*[a-zA-Z0-9_])?';
export const MENTION_RE = new RegExp(`(?<![\\w@.-])@(${HANDLE})`, 'g');
const MENTION_HANDLE_RE = new RegExp(`^${HANDLE}$`);

export const isMentionHandle = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= 100 && MENTION_HANDLE_RE.test(value);

const hasUnsafeUrlCharacter = (value: string) =>
  [...value].some(
    (character) => character === '\\' || /[\p{White_Space}\p{Cc}\p{Cf}]/u.test(character),
  );

function isWebUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') && !url.username && !url.password
    );
  } catch {
    return false;
  }
}

export function isSafeLinkHref(value: unknown): value is string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > 2_048 ||
    hasUnsafeUrlCharacter(value)
  )
    return false;
  if (value.startsWith('#')) return true;
  if (value.startsWith('/') && !value.startsWith('//')) return true;
  if (/^(mailto:|tel:)/i.test(value)) return value.slice(value.indexOf(':') + 1).length > 0;
  return isWebUrl(value);
}

const DOCUMENT_ASSET_PATH =
  /^\/(?:protected-media\/)?projects\/[A-Za-z0-9._~%+-]+\/documents\/[1-9]\d*\/assets\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/raw$/i;

// A page shows images from the web and its own uploads. Any other path would be read
// from the web origin of whoever opens the page.
export function isSafeDocumentImageSource(value: unknown): value is string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > 4_096 ||
    hasUnsafeUrlCharacter(value)
  )
    return false;
  return DOCUMENT_ASSET_PATH.test(value) || isWebUrl(value);
}

export const isHexColor = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value);

const RGB = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*([\d.]+)\s*)?\)$/i;

// The colour a page stores, as hex. The browser writes a colour back as rgb() when it
// serializes the editor's HTML, so that form is read as hex. Any other colour is dropped
// and the text stays.
export function documentColor(value: string | null | undefined): string | null {
  const color = value?.replace(/['"]+/g, '').trim();
  if (!color) return null;
  if (isHexColor(color)) return color;
  const rgb = RGB.exec(color);
  if (!rgb) return null;
  const channels = rgb.slice(1, 4).map(Number);
  const alpha = rgb[4] === undefined ? 1 : Number(rgb[4]);
  if (channels.some((channel) => channel > 255) || !(alpha >= 0 && alpha <= 1)) return null;
  const hex = (channel: number) => channel.toString(16).padStart(2, '0');
  return `#${channels.map(hex).join('')}${alpha < 1 ? hex(Math.round(alpha * 255)) : ''}`;
}

// An image's inline style is applied for every reader of the text that carries it, so
// only its sizing survives: any other declaration (position, inset, z-index) could lay
// the image over the whole page.
const IMAGE_STYLE_PROPERTIES = new Set(['width', 'max-width']);
// A pixel or percentage length, capped like the image width, or `auto`.
const IMAGE_STYLE_LENGTH = /^(?:auto|[1-9]\d{0,3}px|(?:100|[1-9]\d?)%)$/;

function imageStyleDeclarations(css: string) {
  return css
    .split(';')
    .filter((declaration) => declaration.trim())
    .map((declaration) => {
      const colon = declaration.indexOf(':');
      const property = declaration.slice(0, colon).trim().toLowerCase();
      const value = declaration
        .slice(colon + 1)
        .trim()
        .toLowerCase();
      return {
        allowed:
          colon !== -1 && IMAGE_STYLE_PROPERTIES.has(property) && IMAGE_STYLE_LENGTH.test(value),
        text: `${property}: ${value}`,
      };
    });
}

export function allowedImageStyle(css: string | null | undefined): string | null {
  if (!css) return null;
  const kept = imageStyleDeclarations(css).filter((declaration) => declaration.allowed);
  return kept.length > 0 ? kept.map((declaration) => declaration.text).join('; ') : null;
}

export function isAllowedImageStyle(css: unknown): boolean {
  if (typeof css !== 'string') return false;
  const declarations = imageStyleDeclarations(css);
  return declarations.length > 0 && declarations.every((declaration) => declaration.allowed);
}

export function imageWidth(value: string | null): number | null {
  const width = Number.parseInt(value ?? '', 10);
  return width >= 1 && width <= 4_096 ? width : null;
}
