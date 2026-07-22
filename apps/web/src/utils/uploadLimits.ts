import type { StorageSettings } from '@/lib/api';

// Client-side mirror of the api's upload checks (apps/api/src/attachments/routes.ts).
// The api enforces the real limits; these helpers state them in the UI and reject an
// oversized or unaccepted file before it is sent.

const MB = 1024 * 1024;

// The `accept` attribute for a file input, or undefined when any type is allowed.
export function attachmentAccept(limits: StorageSettings | undefined): string | undefined {
  const types = limits?.attachmentMimeTypes ?? [];
  return types.length > 0 ? types.join(',') : undefined;
}

// Plain names for the MIME types an instance can accept. Several types share one
// name (a .doc, a .docx and an .odt are all documents), so the hint stays short.
const TYPE_NAMES: Record<string, string> = {
  'image/*': 'images',
  'video/*': 'video',
  'audio/*': 'audio',
  'application/pdf': 'PDF',
  'text/plain': 'text',
  'text/csv': 'CSV',
  'text/markdown': 'Markdown',
  'application/msword': 'documents',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'documents',
  'application/vnd.oasis.opendocument.text': 'documents',
  'application/vnd.ms-excel': 'spreadsheets',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'spreadsheets',
  'application/vnd.oasis.opendocument.spreadsheet': 'spreadsheets',
  'application/vnd.ms-powerpoint': 'presentations',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'presentations',
  'application/vnd.oasis.opendocument.presentation': 'presentations',
};

// A type with no entry above falls back to its last segment ("application/zip" reads
// as "ZIP"), which is closer to what people call the file than the full MIME type.
function typeName(mimeType: string): string {
  const type = mimeType.trim().toLowerCase();
  const known = TYPE_NAMES[type];
  if (known) return known;
  const subtype = type.split('/')[1] ?? type;
  return subtype.split('.').pop()!.toUpperCase();
}

// The sentence shown next to the picker: the size limit, plus the accepted types
// when the instance restricts them.
export function attachmentLimitHint(limits: StorageSettings | undefined): string {
  if (!limits) return '';
  const size = `Up to ${limits.maxAttachmentMb} MB per file.`;
  const names = [...new Set(limits.attachmentMimeTypes.map(typeName))];
  return names.length > 0 ? `${size} Accepted: ${names.join(', ')}.` : size;
}

// The reason a file cannot be uploaded, or null when it passes.
export function attachmentError(file: File, limits: StorageSettings | undefined): string | null {
  if (!limits) return null;
  if (file.size > limits.maxAttachmentMb * MB) {
    return `"${file.name}" exceeds the ${limits.maxAttachmentMb} MB limit`;
  }
  const types = limits.attachmentMimeTypes;
  if (types.length > 0) {
    const ct = (file.type || '').toLowerCase();
    const ok = types.some((entry) => {
      const pattern = entry.trim().toLowerCase();
      return pattern.endsWith('/*') ? ct.startsWith(pattern.slice(0, -1)) : ct === pattern;
    });
    if (!ok) return `"${file.name}" is not an accepted file type`;
  }
  return null;
}
