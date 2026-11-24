'use client';

import { useRef, useState, type ReactNode, type Ref } from 'react';
import type { Editor } from '@tiptap/react';
import type { ProjectDocument } from '@/lib/api/endpoints/documents';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import { useDocumentOutline } from '../../hooks/useDocumentOutline';
import DocumentMarkdownEditor from '../DocumentMarkdownEditor';
import DocumentOutline from './DocumentOutline';
import DocumentPageTitle from './DocumentPageTitle';
import { type DocumentSelection } from '../DocumentSelectionActions';
import DocumentToolbar from './DocumentToolbar';

// A sticky toolbar sits above the scroll container; otherwise it scrolls away with the page.
export default function DocumentEditorCanvas({
  projectKey,
  document,
  title,
  content,
  contentJson,
  editorRevision,
  editor,
  titleRef,
  editing,
  editable,
  sidePanelOpen,
  stickyToolbar,
  banner,
  properties,
  subpages,
  onComment,
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
  titleRef: Ref<HTMLTextAreaElement>;
  // The page is open for editing: the toolbar and the title editor show.
  editing: boolean;
  // The editing session is ready, so input is accepted.
  editable: boolean;
  sidePanelOpen: boolean;
  stickyToolbar: boolean;
  banner: ReactNode;
  properties: ReactNode;
  subpages: ReactNode;
  onComment: (selection: DocumentSelection) => void;
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const { outline, activeIndex, jumpTo } = useDocumentOutline(editor, scrollRef);
  const showOutline = outline.length > 0 && !sidePanelOpen;

  // Until the session is ready the toolbar shows its placeholder, so no command reaches
  // an editor that does not take input yet.
  const toolbar = editing && (
    <div
      className={cn(
        'relative z-[4] shrink-0 border-b bg-background transition-shadow',
        stickyToolbar && scrolled && 'shadow-[0_8px_16px_-12px_rgb(0_0_0/0.35)]',
      )}
    >
      <DocumentToolbar
        editor={editable ? editor : null}
        projectKey={projectKey}
        documentId={document.id}
        canUpload={editable}
        onComment={onComment}
      />
    </div>
  );

  return (
    <>
      {stickyToolbar && toolbar}
      {banner}
      <div
        ref={scrollRef}
        className="@container/canvas min-h-0 flex-1 [scrollbar-width:thin] overflow-y-auto overscroll-contain"
        onScroll={(event) => setScrolled(event.currentTarget.scrollTop > 4)}
      >
        {!stickyToolbar && toolbar}
        <div
          className={cn(
            'grid grid-cols-1 gap-x-12 px-[clamp(16px,3vw,40px)] pt-10',
            showOutline && '@min-[960px]/canvas:grid-cols-[minmax(0,1fr)_216px]',
          )}
        >
          <article className="relative min-w-0 animate-in pb-40 duration-300 fade-in motion-reduce:animate-none">
            <DocumentPageTitle
              ref={titleRef}
              title={title}
              icon={document.icon}
              canEdit={editing}
              editable={editable}
              onChange={onTitleChange}
              onSave={onTitleSave}
              onSubmit={() => editor?.commands.focus('start')}
              onIconChange={onIconChange}
            >
              {properties}
            </DocumentPageTitle>
            <DocumentMarkdownEditor
              key={`${document.id}:${editorRevision}`}
              projectKey={projectKey}
              documentId={document.id}
              onComment={onComment}
              defaultValue={content}
              defaultJson={contentJson}
              editable={editable}
              collaborative
              placeholder={t('contentPlaceholder')}
              onReady={onEditorReady}
              onChange={onContentChange}
              onBlur={onContentBlur}
              onUploadImage={editable ? onUploadImage : undefined}
            />
            {subpages}
          </article>
          {showOutline && (
            <div className="hidden min-w-0 @min-[960px]/canvas:block">
              <DocumentOutline outline={outline} activeIndex={activeIndex} onJump={jumpTo} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
