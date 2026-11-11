import { isImage, isVideo, type Embeddable } from '@/components/common/editor/attachmentEmbed';

export type AttachmentPreviewKind =
  'image' | 'video' | 'pdf' | 'docx' | 'xlsx' | 'pptx' | 'csv' | 'markdown' | 'text';

// The extension decides before the content type: browsers report a .csv as
// application/vnd.ms-excel on Windows and a .md as application/octet-stream.
const KIND_BY_EXTENSION: Record<string, AttachmentPreviewKind> = {
  pdf: 'pdf',
  docx: 'docx',
  doc: 'docx',
  xlsx: 'xlsx',
  xlsm: 'xlsx',
  xls: 'xlsx',
  pptx: 'pptx',
  ppt: 'pptx',
  csv: 'csv',
  tsv: 'csv',
  md: 'markdown',
  markdown: 'markdown',
};

const KIND_BY_CONTENT_TYPE: Record<string, AttachmentPreviewKind> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/msword': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-excel': 'xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.ms-powerpoint': 'pptx',
  'text/csv': 'csv',
  'text/tab-separated-values': 'csv',
  'text/markdown': 'markdown',
  'application/json': 'text',
  'application/xml': 'text',
  'application/yaml': 'text',
  'application/x-yaml': 'text',
  'application/toml': 'text',
  'application/sql': 'text',
  'application/javascript': 'text',
  'application/x-sh': 'text',
};

// Source and config files a browser reports as application/octet-stream or with
// no type at all.
const TEXT_EXTENSIONS = new Set([
  'txt',
  'log',
  'json',
  'xml',
  'yml',
  'yaml',
  'toml',
  'ini',
  'conf',
  'env',
  'sql',
  'sh',
  'bash',
  'js',
  'jsx',
  'mjs',
  'cjs',
  'ts',
  'tsx',
  'css',
  'scss',
  'html',
  'htm',
  'vue',
  'svelte',
  'py',
  'rb',
  'go',
  'rs',
  'java',
  'kt',
  'swift',
  'c',
  'h',
  'cpp',
  'hpp',
  'cs',
  'php',
  'lua',
  'diff',
  'patch',
  'gradle',
  'properties',
  'graphql',
  'proto',
]);

// A larger file is offered for download: parsing it on the main thread would
// freeze the tab.
const MAX_PREVIEW_BYTES: Partial<Record<AttachmentPreviewKind, number>> = {
  text: 1024 * 1024,
  markdown: 1024 * 1024,
  csv: 10 * 1024 * 1024,
};

// The lowercase extension of a file name, or '' when it has none.
export function fileExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot > 0 ? filename.slice(dot + 1).toLowerCase() : '';
}

// What the viewer shows the attachment as, or null when it can only be downloaded.
export function attachmentPreviewKind(attachment: Embeddable): AttachmentPreviewKind | null {
  if (isImage(attachment)) return 'image';
  if (isVideo(attachment)) return 'video';
  const extension = fileExtension(attachment.filename);
  const contentType = attachment.contentType.split(';')[0].trim().toLowerCase();
  return (
    KIND_BY_EXTENSION[extension] ??
    KIND_BY_CONTENT_TYPE[contentType] ??
    (TEXT_EXTENSIONS.has(extension) || contentType.startsWith('text/') ? 'text' : null)
  );
}

export function exceedsPreviewLimit(kind: AttachmentPreviewKind, sizeBytes: number): boolean {
  const limit = MAX_PREVIEW_BYTES[kind];
  return limit !== undefined && sizeBytes > limit;
}
