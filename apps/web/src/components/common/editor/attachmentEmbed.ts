import { type Editor } from '@tiptap/react';

// Embedding an attachment into a description. Both a stored Attachment and a
// fresh upload response satisfy this shape.
export type Embeddable = { url: string; contentType: string; filename: string };

export const isImage = (a: Embeddable) => a.contentType.startsWith('image/');
export const isVideo = (a: Embeddable) => a.contentType.startsWith('video/');

// HTML handed to the tiptap editor (drag from the Attachments panel, file drop
// on the editor): images become an inline <img>, videos an inline <video>,
// everything else a link. tiptap parses the HTML through its schema, so each
// lands as the matching node.
export function attachmentHtml(a: Embeddable): string {
  if (isImage(a)) return `<img src="${a.url}" alt="${a.filename}">`;
  if (isVideo(a)) return `<video src="${a.url}" controls></video>`;
  return `<a href="${a.url}">${a.filename}</a>`;
}

// The same embed as markdown, for appending to the description text directly.
// Markdown has no video syntax, so a video stays a raw <video> tag (the Video
// tiptap node parses it back).
export function attachmentMarkdown(a: Embeddable): string {
  if (isImage(a)) return `![${a.filename}](${a.url})`;
  if (isVideo(a)) return `<video src="${a.url}" controls></video>`;
  return `[${a.filename}](${a.url})`;
}

// Drops the embeds of `url` from markdown text: a markdown image or link, plus
// the raw <img>/<video> tags a sized image and a video serialize to. Used on a
// URL that never became an attachment, so no dead link is stored.
export function stripEmbed(markdown: string, url: string): string {
  const quoted = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return markdown
    .replace(new RegExp(`!?\\[[^\\]]*\\]\\(${quoted}\\)`, 'g'), '')
    .replace(new RegExp(`<img\\b[^>]*src="${quoted}"[^>]*>`, 'g'), '')
    .replace(new RegExp(`<video[^>]*src="${quoted}"[^>]*>\\s*</video>`, 'g'), '');
}

// Points the embeds of `from` at `to` on a live editor. Used when a pending file
// is swapped for an annotated copy, which lives at a new blob: URL. Only nodes
// with a src are rewritten — an annotated file is an image, never a link.
export function replaceEmbed(editor: Editor, from: string, to: string) {
  if (editor.isDestroyed) return;
  const { tr, doc } = editor.state;
  doc.descendants((node, pos) => {
    if (node.attrs.src !== from) return;
    tr.setNodeMarkup(pos, undefined, { ...node.attrs, src: to });
    return false;
  });
  if (tr.docChanged) editor.view.dispatch(tr);
}

// The same removal on a live editor: the image or video node carrying `url` as
// src, and a link pointing at it.
export function removeEmbed(editor: Editor, url: string) {
  if (editor.isDestroyed) return;
  const { tr, doc } = editor.state;
  doc.descendants((node, pos) => {
    if (node.attrs.src !== url && !node.marks.some((m) => m.attrs.href === url)) return;
    tr.delete(tr.mapping.map(pos), tr.mapping.map(pos + node.nodeSize));
    return false;
  });
  if (tr.docChanged) editor.view.dispatch(tr);
}
