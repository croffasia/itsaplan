import { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { TableKit } from '@tiptap/extension-table';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import { common, createLowlight } from 'lowlight';
import { Markdown } from 'tiptap-markdown';
import { ResizableImage } from '../../utils/tiptap-image';
import { Mention } from '@/lib/tiptap-mention';
import { SlashCommand } from '@/lib/tiptap-slash-command';
import { MarkdownTable } from '../../utils/tiptap-table';
import { Video } from '../../utils/tiptap-video';
import { attachmentHtml, type Embeddable } from '../../utils/attachmentEmbed';
import { openLinkOnModifierClick } from '../../utils/modifierClickLink';
import EditorImagePicker from './EditorImagePicker';
import EditorSelectionMenu from '@/components/common/editor/EditorSelectionMenu';
import EditorTableMenu from '@/components/common/editor/EditorTableMenu';
import { useMentionCandidates } from '@/hooks/useMentionCandidates';
import { useTranslations } from 'next-intl';

// Shared by every editor instance. A block with no language is detected by
// highlightAuto, so there is no language picker.
const lowlight = createLowlight(common);

export const issueEditorStarterKitOptions = {
  codeBlock: false,
  link: false,
} as const;

// A minimal WYSIWYG editor over markdown text — no persistent toolbar, just a
// bubble menu on selection and a "/" command list (Linear/Notion-style). Content
// in and out is plain markdown (via tiptap-markdown), matching how descriptions
// are stored everywhere else in the pipeline.
export default function IssueMarkdownEditor({
  defaultValue,
  onChange,
  onBlur,
  onReady,
  placeholder,
  className,
  editable = true,
  uploadFile,
  imageAttachments,
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
  // drop position (image/video inline, other files as a link).
  uploadFile?: (file: File) => Promise<Embeddable>;
  // Offered in a picker, to embed an upload again. Omitted where there is no
  // issue to read them from yet (the create modal), which drops the picker.
  imageAttachments?: Embeddable[];
}) {
  const t = useTranslations('issue.editor');
  const tCommon = useTranslations('common.editor');
  const editorRef = useRef<Editor | null>(null);
  // Held in a ref because the extensions are built once: the "@" menu reads the
  // roster through it, so a list that arrives later is still offered.
  const mentionCandidates = useMentionCandidates();
  const mentionCandidatesRef = useRef(mentionCandidates);
  mentionCandidatesRef.current = mentionCandidates;
  const [imagePickerOpen, setImagePickerOpen] = useState(false);

  // Upload each file and insert it (image/video inline, other files as a link)
  // starting at `pos`, advancing past each insertion. Shared by drop and paste.
  const insertFiles = (files: FileList, pos: number) => {
    void (async () => {
      for (const file of Array.from(files)) {
        const a = await uploadFile?.(file).catch(() => null);
        const ed = editorRef.current;
        if (!a || !ed) continue;
        ed.chain().insertContentAt(pos, attachmentHtml(a)).focus().run();
        pos = ed.state.selection.to;
      }
    })();
  };

  const editor = useEditor({
    editable,
    extensions: [
      // Replaces StarterKit's plain code block, keeping the node name codeBlock.
      StarterKit.configure(issueEditorStarterKitOptions),
      CodeBlockLowlight.configure({ lowlight }),
      Placeholder.configure({ placeholder }),
      Link.configure({ openOnClick: false, autolink: true }),
      // Renders ![](url) markdown inline.
      ResizableImage,
      // Renders an @username in the text as a mention chip, and offers the project's
      // members and agents while one is typed.
      Mention.configure({ items: () => mentionCandidatesRef.current }),
      // Renders video attachments as an inline <video> player.
      Video,
      // TableKit carries the row and cell nodes around MarkdownTable's table node.
      // Column widths are not resizable: markdown carries no width, so a resized
      // column would be lost the next time the description is read back.
      TableKit.configure({ table: false }),
      MarkdownTable.configure({ resizable: false }),
      SlashCommand.configure({
        codeBlockLabel: tCommon('codeBlock'),
        tableLabel: tCommon('table'),
        image: imageAttachments
          ? { label: t('image'), onPick: () => setImagePickerOpen(true) }
          : undefined,
      }),
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
        // flex-1 so the typing area covers a container taller than the text.
        class: 'md-content flex-1 focus:outline-none',
      },
      handleClick(view, _pos, event) {
        return openLinkOnModifierClick(event, view.dom);
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
        insertFiles(files, coords?.pos ?? view.state.selection.to);
        return true;
      },
      // A pasted screenshot or copied file arrives as clipboard files: upload
      // each and insert at the cursor, same as a drop. Plain text/html pastes
      // carry no files and fall through to tiptap's default handling.
      handlePaste(view, event) {
        if (!uploadFile) return false;
        const files = event.clipboardData?.files;
        if (!files || files.length === 0) return false;
        event.preventDefault();
        insertFiles(files, view.state.selection.to);
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
      {editable && <EditorSelectionMenu editor={editor} />}
      {editable && <EditorTableMenu editor={editor} />}
      {/* Grows with the text rather than being pinned to the container's height,
          so a container that scrolls measures the overflow and shows a bar. */}
      <EditorContent editor={editor} className="flex min-h-full flex-col" />
      {imageAttachments && (
        <EditorImagePicker
          open={imagePickerOpen}
          images={imageAttachments}
          onClose={() => setImagePickerOpen(false)}
          onPick={(a) => {
            setImagePickerOpen(false);
            editor.chain().focus().insertContent(attachmentHtml(a)).run();
          }}
        />
      )}
    </div>
  );
}
