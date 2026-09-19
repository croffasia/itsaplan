import type { ProjectFile } from '@/lib/api';

// How a file is shown: an image element, the browser's PDF viewer, or escaped text.
export type FilePreviewKind = 'image' | 'pdf' | 'text';

export interface FilePreview {
  kind: FilePreviewKind;
  // The type the preview blob is labelled with, which is what decides how the
  // browser renders it. Never the type the uploader claimed.
  type: string;
  label: string;
}

// Only formats the browser renders without a plugin, and only ones whose first
// bytes can be checked. A type is decided by the extension as well as the stored
// content type, because an upload from some clients arrives as
// application/octet-stream.
const IMAGES: { type: string; extensions: string[]; label: string }[] = [
  { type: 'image/png', extensions: ['.png'], label: 'PNG' },
  { type: 'image/jpeg', extensions: ['.jpg', '.jpeg'], label: 'JPEG' },
  { type: 'image/gif', extensions: ['.gif'], label: 'GIF' },
  { type: 'image/webp', extensions: ['.webp'], label: 'WebP' },
];

const TEXT_EXTENSIONS = [
  '.txt',
  '.md',
  '.csv',
  '.json',
  '.log',
  '.yml',
  '.yaml',
  '.xml',
  '.ini',
  '.env',
];

const TEXT_TYPES = ['text/plain', 'text/markdown', 'text/csv', 'application/json'];

// A text preview is rendered as characters, never as markup, so the cap is only
// there to keep a large log from freezing the dialog.
export const TEXT_PREVIEW_MAX_CHARS = 200_000;

export function filePreviewType(file: ProjectFile): FilePreview | null {
  const filename = file.filename.toLowerCase();
  const ends = (extensions: string[]) => extensions.some((value) => filename.endsWith(value));

  for (const image of IMAGES) {
    if (file.contentType === image.type || ends(image.extensions)) {
      return { kind: 'image', type: image.type, label: image.label };
    }
  }
  if (file.contentType === 'application/pdf' || filename.endsWith('.pdf')) {
    return { kind: 'pdf', type: 'application/pdf', label: 'PDF' };
  }
  if (TEXT_TYPES.includes(file.contentType) || ends(TEXT_EXTENSIONS)) {
    return { kind: 'text', type: 'text/plain', label: 'Text' };
  }
  return null;
}

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  return signature.every((value, index) => bytes[offset + index] === value);
}

// The first bytes have to match the format the preview claims. Without it a file
// named .png could be handed to the browser labelled as an image while holding
// something else entirely.
export async function hasValidPreviewSignature(blob: Blob, preview: FilePreview): Promise<boolean> {
  if (preview.kind === 'text') return true;
  const bytes = new Uint8Array(await blob.slice(0, 16).arrayBuffer());

  switch (preview.type) {
    case 'image/png':
      return startsWith(bytes, [137, 80, 78, 71, 13, 10, 26, 10]);
    case 'image/jpeg':
      return startsWith(bytes, [255, 216, 255]);
    case 'image/gif':
      return startsWith(bytes, [71, 73, 70, 56]);
    case 'image/webp':
      // 'RIFF' .... 'WEBP'
      return startsWith(bytes, [82, 73, 70, 70]) && startsWith(bytes, [87, 69, 66, 80], 8);
    default:
      // '%PDF-'
      return startsWith(bytes, [37, 80, 68, 70, 45]);
  }
}
