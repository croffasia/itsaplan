import { request, uploadFile } from '@/lib/api/core/client';
import { mediaUrl } from '@/lib/api/core/media';

// The attachment DTO's url is relative to the API origin; point it at the web
// origin's media route so it works in <img>/<video> and markdown rendered there.
function withMediaUrl(a: Attachment): Attachment {
  return { ...a, url: mediaUrl(a.url) };
}

const sendAttachmentFile = (path: string, method: 'POST' | 'PUT', file: File) =>
  uploadFile<Attachment>(path, method, file).then(withMediaUrl);

export interface Attachment {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
  // Absolute, no-auth URL — usable directly in <img>/<video> and in markdown.
  url: string;
}

export const listAttachments = (issueId: number) =>
  request<Attachment[]>(`/issues/${issueId}/attachments`).then((rows) => rows.map(withMediaUrl));

export const uploadAttachment = (issueId: number, file: File) =>
  sendAttachmentFile(`/issues/${issueId}/attachments`, 'POST', file);

// Keeps the attachment's id and URL, so an embed of it in a description shows
// the new file.
export const replaceAttachment = (publicId: string, file: File) =>
  sendAttachmentFile(`/attachments/${publicId}`, 'PUT', file);

export const deleteAttachment = (publicId: string) =>
  request<void>(`/attachments/${publicId}`, { method: 'DELETE' });

export const listInitiativeAttachments = (initiativeId: number) =>
  request<Attachment[]>(`/initiatives/${initiativeId}/attachments`).then((rows) =>
    rows.map(withMediaUrl),
  );

export const uploadInitiativeAttachment = (initiativeId: number, file: File) =>
  sendAttachmentFile(`/initiatives/${initiativeId}/attachments`, 'POST', file);

export const deleteInitiativeAttachment = (publicId: string) =>
  request<void>(`/initiative-attachments/${publicId}`, { method: 'DELETE' });
