// Microsoft Graph keeps no arbitrary content type for a file, so the SharePoint driver
// works one out on read: from the key's extension (attachment keys end in the stored
// filename), else from the leading bytes (avatar keys have no extension). The
// attachment routes prefer the content type stored in the database row anyway.

const BY_EXTENSION: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  pdf: 'application/pdf',
  txt: 'text/plain',
  md: 'text/markdown',
  csv: 'text/csv',
  html: 'text/html',
  htm: 'text/html',
  xml: 'application/xml',
  json: 'application/json',
  zip: 'application/zip',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

export const DEFAULT_CONTENT_TYPE = 'application/octet-stream';

export function contentTypeFromKey(key: string): string | null {
  const name = key.split('/').pop() ?? '';
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return null;
  return BY_EXTENSION[name.slice(dot + 1).toLowerCase()] ?? null;
}

const ascii = (bytes: Uint8Array, start: number, text: string) =>
  [...text].every((c, i) => bytes[start + i] === c.charCodeAt(0));

export function sniffContentType(bytes: Uint8Array): string | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && ascii(bytes, 1, 'PNG')) return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return 'image/jpeg';
  if (ascii(bytes, 0, 'GIF8')) return 'image/gif';
  if (ascii(bytes, 0, 'RIFF') && ascii(bytes, 8, 'WEBP')) return 'image/webp';
  if (ascii(bytes, 4, 'ftypavif') || ascii(bytes, 4, 'ftypavis')) return 'image/avif';
  if (ascii(bytes, 0, '%PDF')) return 'application/pdf';
  return null;
}
