import type { NoteSticker } from '@/lib/api';

// Leading heading or bullet marker, stripped from a body line promoted to the
// issue title.
const LINE_MARKER = /^(#{1,6}|[-*+])\s+/;

// The checkbox of a task-list item, keeping its indent and bullet.
const CHECKBOX = /^(\s*[-*+]\s+)\[[ xX]\]\s+/gm;

// The issue editor has no task list, so a checklist would render as literal
// "[ ]" text there. Drop the checkboxes and keep a plain bullet list.
function checklistToBullets(markdown: string): string {
  return markdown.replace(CHECKBOX, '$1');
}

// A sticky note mapped onto the title and description of a new issue. Both sides
// store markdown, so the body carries over as it is apart from the checkboxes. A
// note with no title falls back to its first body line, which then leaves the
// description.
export function stickerToIssue(sticker: NoteSticker): { title: string; description: string } {
  const title = sticker.title.trim();
  const body = checklistToBullets(sticker.body.trim());
  if (title) return { title, description: body };

  const [firstLine, ...rest] = body.split('\n');
  return {
    title: firstLine.trim().replace(LINE_MARKER, ''),
    description: rest.join('\n').trim(),
  };
}
