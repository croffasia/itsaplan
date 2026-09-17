import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Markdown } from 'tiptap-markdown';

export function stickerEditorExtensions(placeholder: string) {
  return [
    StarterKit.configure({ link: false }),
    Link.configure({
      openOnClick: true,
      HTMLAttributes: { class: 'cursor-pointer', tabindex: '0' },
    }),
    Placeholder.configure({ placeholder }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Markdown.configure({ html: false, linkify: true, breaks: true }),
  ];
}
