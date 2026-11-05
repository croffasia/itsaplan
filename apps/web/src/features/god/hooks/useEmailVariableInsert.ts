'use client';

import { useRef } from 'react';
import type { EmailText } from '@/lib/api/endpoints/god';
import { replaceSelection, selectAfterEdit } from '../utils/emailMarkdown';

// Puts a variable at the cursor of the field last in focus: a subject and a button take
// variables as the text does. The text takes it when that field is not on the screen.
export function useEmailVariableInsert(
  text: EmailText,
  change: (patch: Partial<EmailText>) => void,
) {
  const subject = useRef<HTMLInputElement>(null);
  const body = useRef<HTMLTextAreaElement>(null);
  const button = useRef<HTMLInputElement>(null);
  const focused = useRef<keyof EmailText>('body');
  const elements = { subject, body, button };

  function insert(name: string) {
    const field = elements[focused.current].current ? focused.current : 'body';
    const element = elements[field].current;
    if (!element) return;
    const start = element.selectionStart ?? text[field].length;
    const end = element.selectionEnd ?? start;
    const next = replaceSelection(text[field], start, end, `{${name}}`);
    change({ [field]: next.value });
    selectAfterEdit(element, next);
  }

  return {
    subject,
    body,
    button,
    track: (field: keyof EmailText) => {
      focused.current = field;
    },
    insert,
  };
}
