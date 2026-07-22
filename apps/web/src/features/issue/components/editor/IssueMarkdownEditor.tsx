import { useEffect, useRef } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { Markdown } from 'tiptap-markdown';
import { Video } from '../../utils/tiptap-video';
import { attachmentHtml } from '../../utils/attachmentEmbed';
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// A minimal WYSIWYG editor over markdown text — no persistent toolbar, just a
// floating bubble menu on selection (Linear/Notion-style). Content in and out
// is plain markdown (via tiptap-markdown), matching how descriptions are
// stored everywhere else in the pipeline.

function ToolbarButton({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      // Selection collapses on mousedown-then-click otherwise — the bubble
      // menu would disappear before the command runs.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        'flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground [&_svg]:size-3.5',
        active && 'bg-accent text-accent-foreground',
      )}
    >
      {children}
    </button>
  );
}

export default function IssueMarkdownEditor({
  defaultValue,
  onChange,
  onBlur,
  onReady,
  placeholder = 'Add description…',
  className,
  editable = true,
  uploadFile,
}: {
  defaultValue: string;
  onChange?: (markdown: string) => void;
  onBlur?: (markdown: string) => void;
  // Exposes the editor instance so a parent can read the live markdown (via
  // editor.storage.markdown.getMarkdown()) or insert content at the cursor.
  onReady?: (editor: Editor | null) => void;
  placeholder?: string;
  className?: string;
  // When false the content is read-only (no bubble menu, no editing) — used to
  // render comment bodies as markdown.
  editable?: boolean;
  // When set, files dropped onto the editor are uploaded and inserted at the
  // drop position (image/video inline, other files as a link). The uploaded
  // shape mirrors the Attachment DTO.
  uploadFile?: (file: File) => Promise<{ url: string; contentType: string; filename: string }>;
}) {
  const editorRef = useRef<Editor | null>(null);
  const editor = useEditor({
    editable,
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder }),
      Link.configure({ openOnClick: false, autolink: true }),
      // Renders ![](url) markdown inline. Attachments are embedded this way from
      // the issue's Attachments panel. `style` is preserved so a raw
      // <img style="max-width:50%"> (used to embed Instagram photos at half size)
      // keeps its sizing; plain markdown images carry no style and render full width.
      Image.extend({
        addAttributes() {
          return { ...this.parent?.(), style: { default: null } };
        },
      }),
      // Renders video attachments as an inline <video> player.
      Video,
      // html:true so the custom <video> tag survives the markdown round-trip.
      // tiptap only instantiates nodes declared in its schema (there is no
      // script/iframe node), so this does not allow arbitrary HTML to execute.
      // breaks:true renders a single newline as a line break (matching the
      // pipeline's post-doc format, where "Source:"/"Website:" field lines are
      // separated by single \n — the same breaks:true semantics Plane/Linear use).
      Markdown.configure({ html: true, linkify: true, breaks: true }),
    ],
    content: defaultValue,
    editorProps: {
      attributes: {
        class: 'md-content focus:outline-none',
      },
      // Files dropped from the OS are uploaded, then inserted at the drop
      // position. Internal moves and attachment-card drags (which carry
      // text/html, not files) fall through to tiptap's default handling.
      handleDrop(view, event, _slice, moved) {
        if (moved || !uploadFile) return false;
        const files = event.dataTransfer?.files;
        if (!files || files.length === 0) return false;
        event.preventDefault();
        const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
        let pos = coords?.pos ?? view.state.selection.to;
        void (async () => {
          for (const file of Array.from(files)) {
            const a = await uploadFile(file).catch(() => null);
            const ed = editorRef.current;
            if (!a || !ed) continue;
            ed.chain().insertContentAt(pos, attachmentHtml(a)).focus().run();
            pos = ed.state.selection.to;
          }
        })();
        return true;
      },
    },
    onUpdate: ({ editor }) => onChange?.(editor.storage.markdown.getMarkdown()),
    onBlur: ({ editor }) => onBlur?.(editor.storage.markdown.getMarkdown()),
  });

  useEffect(() => {
    editorRef.current = editor;
    onReady?.(editor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  if (!editor) return null;

  return (
    <div className={className}>
      {editable && (
        <BubbleMenu
          editor={editor}
          options={{ placement: 'top' }}
          className="flex items-center gap-0.5 rounded-md border bg-popover p-1 shadow-md"
        >
          <ToolbarButton
            active={editor.isActive('bold')}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <Bold />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('italic')}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <Italic />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('strike')}
            onClick={() => editor.chain().focus().toggleStrike().run()}
          >
            <Strikethrough />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('code')}
            onClick={() => editor.chain().focus().toggleCode().run()}
          >
            <Code />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('link')}
            onClick={() => {
              const url = window.prompt('Link URL', editor.getAttributes('link').href ?? '');
              if (url === null) return;
              if (url === '') editor.chain().focus().unsetLink().run();
              else editor.chain().focus().setLink({ href: url }).run();
            }}
          >
            <LinkIcon />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('blockquote')}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
          >
            <Quote />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('bulletList')}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            <List />
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('orderedList')}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered />
          </ToolbarButton>
        </BubbleMenu>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}
