import type { EmailText } from '@/lib/api/endpoints/god';

// The edits behind the formatting buttons of the email text, on a textarea's value and
// selection. `start` and `end` are the selection after the edit.
export interface TextEdit {
  value: string;
  start: number;
  end: number;
}

export function wrapSelection(
  value: string,
  start: number,
  end: number,
  before: string,
  after: string,
  sample: string,
): TextEdit {
  const selected = value.slice(start, end) || sample;
  const from = start + before.length;
  return {
    value: value.slice(0, start) + before + selected + after + value.slice(end),
    start: from,
    end: from + selected.length,
  };
}

export function prefixLine(value: string, start: number, prefix: string): TextEdit {
  const line = value.lastIndexOf('\n', start - 1) + 1;
  const cursor = line + prefix.length;
  return { value: value.slice(0, line) + prefix + value.slice(line), start: cursor, end: cursor };
}

export function replaceSelection(
  value: string,
  start: number,
  end: number,
  inserted: string,
): TextEdit {
  const cursor = start + inserted.length;
  return { value: value.slice(0, start) + inserted + value.slice(end), start: cursor, end: cursor };
}

// In the next frame, so the value of the edit is in the field by then.
export function selectAfterEdit(
  element: HTMLInputElement | HTMLTextAreaElement,
  edit: TextEdit,
): void {
  requestAnimationFrame(() => {
    element.focus();
    element.setSelectionRange(edit.start, edit.end);
  });
}

export function writtenText(text: EmailText): string {
  return `${text.subject} ${text.body} ${text.button}`;
}

export function unknownVariables(text: string, variables: string[]): string[] {
  const used = [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]);
  return [...new Set(used)].filter((name) => !variables.includes(name));
}
