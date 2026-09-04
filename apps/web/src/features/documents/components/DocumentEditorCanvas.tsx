'use client';

import { useRef, type RefObject } from 'react';
import type { Editor } from '@tiptap/react';
import type { ProjectDocument } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import DocumentMarkdownEditor, { insertDocumentImage } from './DocumentMarkdownEditor';
import DocumentPageTitle from './DocumentPageTitle';
import DocumentToolbar from './DocumentToolbar';

export function documentToolbarPosition(stickyToolbar: boolean) {
  return stickyToolbar ? 'sticky top-0' : 'relative';
}

export default function DocumentEditorCanvas({
  projectKey,
  document,
  title,
  content,
  contentJson,
  editorRevision,
  editor,
  titleRef,
  editable,
  stickyToolbar,
  updateLabel,
  onEditorReady,
  onTitleChange,
  onTitleSave,
  onIconChange,
  onContentChange,
  onContentBlur,
  onUploadImage,
}: {
  projectKey: string;
  document: ProjectDocument;
  title: string;
  content: string;
  contentJson: ProjectDocument['contentJson'];
  editorRevision: number;
  editor: Editor | null;
  titleRef: RefObject<HTMLTextAreaElement | null>;
  editable: boolean;
  stickyToolbar: boolean;
  updateLabel: string;
  onEditorReady: (editor: Editor | null) => void;
  onTitleChange: (title: string) => void;
  onTitleSave: () => void;
  onIconChange: (icon: string | null) => void;
  onContentChange: (value: {
    markdown: string;
    json: NonNullable<ProjectDocument['contentJson']>;
  }) => void;
  onContentBlur: () => void;
  onUploadImage: (file: File) => Promise<{ url: string; filename: string }>;
}) {
  const t = useTranslations('documents');
  const imageInput = useRef<HTMLInputElement>(null);
  const editableRef = useRef(editable);
  editableRef.current = editable;

  const toolbar = editable ? (
    <div
      className={cn(
        'z-10 border-b bg-background/92 px-3 py-1.5 backdrop-blur-xl supports-[backdrop-filter]:bg-background/78 md:px-5',
        documentToolbarPosition(stickyToolbar),
      )}
    >
      <div className="mx-auto w-full max-w-[920px]">
        <DocumentToolbar
          editor={editor}
          projectKey={projectKey}
          documentId={document.id}
          canUpload={editable}
        />
      </div>
    </div>
  ) : null;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain scroll-smooth">
      {stickyToolbar && toolbar}
      <article
        className={cn(
          'mx-auto flex min-h-full w-full max-w-[860px] animate-in flex-col px-5 pt-10 pb-24 duration-300 fade-in slide-in-from-bottom-1 sm:px-8 md:pt-14 lg:px-14',
          document.fullWidth && 'max-w-[1280px] lg:px-20',
        )}
      >
        {!stickyToolbar && <div className="-mx-3 mb-8 sm:-mx-5">{toolbar}</div>}
        {editable && (
          <input
            ref={imageInput}
            className="sr-only"
            type="file"
            accept="image/*"
            aria-label={t('toolbar.uploadImage')}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.currentTarget.value = '';
              if (!file) return;
              void onUploadImage(file)
                .then((asset) => {
                  insertDocumentImage(editor, editableRef.current, asset.url, asset.filename);
                })
                .catch(() => undefined);
            }}
          />
        )}

        <header className="mb-9 border-b border-border/55 pb-8">
          <DocumentPageTitle
            ref={titleRef}
            title={title}
            icon={document.icon}
            editable={editable}
            onChange={onTitleChange}
            onSave={onTitleSave}
            onIconChange={onIconChange}
          />
          <p className="mt-3 text-xs text-muted-foreground/80" dir="auto">
            {updateLabel}
          </p>
        </header>

        <DocumentMarkdownEditor
          key={`${document.id}:${editorRevision}`}
          defaultValue={content}
          defaultJson={contentJson}
          editable={editable}
          placeholder={t('contentPlaceholder')}
          className="min-h-[58vh] flex-1 text-[15px] leading-7 md:text-base md:leading-7"
          onReady={onEditorReady}
          onChange={onContentChange}
          onBlur={onContentBlur}
          onPickImage={editable ? () => imageInput.current?.click() : undefined}
          onUploadImage={editable ? onUploadImage : undefined}
        />
      </article>
    </div>
  );
}
