// A source's text embeds a file the import downloads later, so the text first names
// the file by its attachment source id and the Attachments phase points the link at
// the stored file once it exists. No @repo/db: unit-tested directly.

const SCHEME = 'import-attachment:';

// The link target a mapping writes in place of a source file's own URL.
export function attachmentLink(attachmentSourceId: string): string {
  return `${SCHEME}${encodeURIComponent(attachmentSourceId)}`;
}

// A markdown image or link whose target is an attachmentLink. Its text may hold an
// escaped character, "\]" among them.
const EMBED = /(!?)\[((?:\\.|[^\]\\])*)\]\(import-attachment:([^)\s]+)\)/g;

// Points each embed at the stored file `urlOf` gives for its source id. An embed of a
// file that was not stored (too large, a type the instance refuses) keeps its text.
export function resolveAttachmentLinks(
  text: string,
  urlOf: (attachmentSourceId: string) => string | undefined,
): string {
  if (!text.includes(SCHEME)) return text;
  return text.replace(EMBED, (_match, bang: string, label: string, encoded: string) => {
    let sourceId: string;
    try {
      sourceId = decodeURIComponent(encoded);
    } catch {
      return label;
    }
    const url = urlOf(sourceId);
    return url ? `${bang}[${label}](${url})` : label;
  });
}
