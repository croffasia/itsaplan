'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import type { JSONContent } from '@tiptap/core';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { TableKit } from '@tiptap/extension-table';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import { type Editor, EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { common, createLowlight } from 'lowlight';
import { useTranslations } from 'next-intl';
import { Markdown } from 'tiptap-markdown';
import EditorSelectionMenu from '@/components/common/editor/EditorSelectionMenu';
import EditorTableMenu from '@/components/common/editor/EditorTableMenu';
import { ResizableImage } from '@/components/common/editor/tiptap-image';
import { MarkdownTable } from '@/components/common/editor/tiptap-table';
import { SlashCommand } from '@/lib/tiptap-slash-command';

const lowlight = createLowlight(common);
const DOCUMENT_ASSET_PATH =
  /^\/(?:protected-media\/)?projects\/[A-Za-z0-9._~%+-]+\/documents\/[1-9]\d*\/assets\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/raw$/i;

function safeDocumentLinkHref(href: string): boolean {
  if (
    href.length === 0 ||
    href.length > 2048 ||
    [...href].some(
      (character) => character === '\\' || /[\p{White_Space}\p{Cc}\p{Cf}]/u.test(character),
    )
  ) {
    return false;
  }
  if (href.startsWith('#')) return true;
  if (href.startsWith('/') && !href.startsWith('//')) return true;
  if (/^(mailto:|tel:).+/i.test(href)) return true;
  try {
    const url = new URL(href);
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') && !url.username && !url.password
    );
  } catch {
    return false;
  }
}

type EditorLabels = {
  placeholder: string;
  codeBlockLabel: string;
  tableLabel: string;
  blocks?: {
    paragraph: string;
    headings: [string, string, string, string, string, string];
    bulletList: string;
    orderedList: string;
    taskList: string;
    quote: string;
    divider: string;
  };
  image?: { label: string; onPick: () => void };
};

type EditorValue = { markdown: string; json: JSONContent };

export function documentEditorExtensions(labels: EditorLabels) {
  return [
    StarterKit.configure({
      codeBlock: false,
      link: false,
      heading: { levels: [1, 2, 3, 4, 5, 6] },
    }),
    CodeBlockLowlight.configure({ lowlight }),
    Placeholder.configure({ placeholder: labels.placeholder }),
    Link.configure({
      autolink: true,
      defaultProtocol: 'https',
      openOnClick: true,
      isAllowedUri: safeDocumentLinkHref,
    }),
    ResizableImage,
    TableKit.configure({ table: false }),
    MarkdownTable.configure({ resizable: false }),
    TaskList,
    TaskItem.configure({ nested: true }),
    TextStyle,
    Color,
    Highlight.configure({ multicolor: true }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    SlashCommand.configure({
      codeBlockLabel: labels.codeBlockLabel,
      tableLabel: labels.tableLabel,
      blocks: labels.blocks,
      image: labels.image,
    }),
    Markdown.configure({ html: true, linkify: true, breaks: true }),
  ];
}

function editorValue(editor: Editor): EditorValue {
  return { markdown: editor.storage.markdown.getMarkdown(), json: editor.getJSON() };
}

export default function DocumentMarkdownEditor({
  defaultValue,
  defaultJson,
  editable,
  placeholder,
  className,
  onReady,
  onChange,
  onBlur,
  onPickImage,
  onUploadImage,
}: {
  defaultValue: string;
  defaultJson: Record<string, unknown> | null;
  editable: boolean;
  placeholder: string;
  className?: string;
  onReady: (editor: Editor | null) => void;
  onChange: (value: EditorValue) => void;
  onBlur: (value: EditorValue) => void;
  onPickImage?: () => void;
  onUploadImage?: (file: File) => Promise<{ url: string; filename: string }>;
}) {
  const t = useTranslations('documents.toolbar');
  const editorRef = useRef<Editor | null>(null);
  const editableRef = useRef(editable);
  editableRef.current = editable;

  const editor = useEditor({
    editable,
    extensions: documentEditorExtensions({
      placeholder,
      codeBlockLabel: t('codeBlock'),
      tableLabel: t('table'),
      blocks: {
        paragraph: t('text'),
        headings: [
          t('heading1'),
          t('heading2'),
          t('heading3'),
          t('heading4'),
          t('heading5'),
          t('heading6'),
        ],
        bulletList: t('bulletList'),
        orderedList: t('numberedList'),
        taskList: t('todoList'),
        quote: t('quote'),
        divider: t('divider'),
      },
      image: onPickImage ? { label: t('uploadImage'), onPick: onPickImage } : undefined,
    }),
    content: defaultJson ?? defaultValue,
    editorProps: {
      attributes: {
        class: 'md-content flex-1 focus:outline-none selection:bg-primary/15',
      },
      handlePaste: (_view, event) => {
        const file = firstImageFile(event.clipboardData?.files);
        const currentEditor = editorRef.current;
        if (!file || !onUploadImage || !currentEditor || !editableRef.current) return false;
        event.preventDefault();
        void uploadAndInsertImage(
          currentEditor,
          file,
          onUploadImage,
          currentEditor.state.selection.from,
          () => editableRef.current,
        );
        return true;
      },
      handleDrop: (view, event, _slice, moved) => {
        const file = firstImageFile(event.dataTransfer?.files);
        const currentEditor = editorRef.current;
        if (moved || !file || !onUploadImage || !currentEditor || !editableRef.current)
          return false;
        const dropPoint = view.posAtCoords({ left: event.clientX, top: event.clientY });
        if (!dropPoint) return false;
        event.preventDefault();
        void uploadAndInsertImage(currentEditor, file, onUploadImage, dropPoint.pos, () =>
          Boolean(editableRef.current),
        );
        return true;
      },
    },
    onCreate: ({ editor: currentEditor }) => {
      editorRef.current = currentEditor;
    },
    onUpdate: ({ editor: currentEditor }) => onChange(editorValue(currentEditor)),
    onBlur: ({ editor: currentEditor }) => onBlur(editorValue(currentEditor)),
    onDestroy: () => {
      editorRef.current = null;
    },
  });

  useEffect(() => {
    editorRef.current = editor;
    onReady(editor);
    return () => onReady(null);
  }, [editor, onReady]);

  useLayoutEffect(() => {
    syncDocumentEditorEditable(editor, editable);
  }, [editable, editor]);

  if (!editor) return null;

  return (
    <div className={className} data-document-editor="">
      {editable && <EditorSelectionMenu editor={editor} />}
      {editable && <EditorTableMenu editor={editor} />}
      <EditorContent editor={editor} className="flex min-h-full flex-col" />
    </div>
  );
}

export function syncDocumentEditorEditable(editor: Editor | null, editable: boolean) {
  if (editor && editor.isEditable !== editable) editor.setEditable(editable);
}

export function insertDocumentImage(
  editor: Editor | null,
  editable: boolean,
  src: string,
  alt?: string,
): boolean {
  const normalizedSource = safeDocumentImageSource(src);
  if (!normalizedSource || !editable || !editor || editor.isDestroyed || !editor.isEditable) {
    return false;
  }
  return editor.chain().focus().setImage({ src: normalizedSource, alt }).run();
}

export function safeDocumentImageSource(source: string): string | null {
  const normalized = source.trim();
  if (
    normalized.length === 0 ||
    normalized.length > 4096 ||
    [...normalized].some(
      (character) => character === '\\' || /[\p{White_Space}\p{Cc}\p{Cf}]/u.test(character),
    )
  ) {
    return null;
  }
  if (DOCUMENT_ASSET_PATH.test(normalized)) return normalized;
  try {
    const url = new URL(normalized);
    if ((url.protocol === 'http:' || url.protocol === 'https:') && !url.username && !url.password) {
      return normalized;
    }
  } catch {
    return null;
  }
  return null;
}

export function firstImageFile(files: ArrayLike<File> | null | undefined): File | null {
  return Array.from(files ?? []).find((file) => file.type.startsWith('image/')) ?? null;
}

export async function uploadAndInsertImage(
  editor: Editor,
  file: File,
  upload: (file: File) => Promise<{ url: string; filename: string }>,
  position: number,
  isEditable: () => boolean = () => editor.isEditable,
): Promise<boolean> {
  try {
    const asset = await upload(file);
    if (editor.isDestroyed || !editor.isEditable || !isEditable()) return false;
    const source = safeDocumentImageSource(asset.url);
    if (!source) return false;
    const safePosition = Math.max(0, Math.min(position, editor.state.doc.content.size));
    return editor
      .chain()
      .focus()
      .insertContentAt(safePosition, {
        type: 'image',
        attrs: { src: source, alt: asset.filename },
      })
      .run();
  } catch {
    return false;
  }
}
