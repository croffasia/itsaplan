// Embedding an attachment into a description. Both a stored Attachment and a
// fresh upload response satisfy this shape.
type Embeddable = { url: string; contentType: string; filename: string };

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
