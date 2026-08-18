import { useEffect, useRef } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import HardBreak from '@tiptap/extension-hard-break';
import Text from '@tiptap/extension-text';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Markdown } from 'tiptap-markdown';
import { useTranslations } from 'next-intl';
import EditorSelectionMenu from '@/components/common/editor/EditorSelectionMenu';
import { SlashCommand } from '@/lib/tiptap-slash-command';

// The two nodes below replace the serializers tiptap-markdown installs for them,
// because this value is not rendered as markdown anywhere — the agent runtime puts it
// into the model's system prompt as it is stored, so every character it adds is a
// character the model reads.

// tiptap-markdown writes text as HTML-escaped, turning a prompt's <thinking> into
// &lt;thinking&gt;. Markdown-it already keeps such a tag literal on the way in
// (html:false), so the text goes back out exactly as it was typed.
const PromptText = Text.extend({
  addStorage: () => ({
    markdown: {
      serialize: (state: { text: (text: string) => void }, node: ProseMirrorNode) =>
        state.text(node.text ?? ''),
    },
  }),
});

// tiptap-markdown ends a hard break with a backslash. With breaks:true a bare newline
// parses back as the same hard break, so the prompt keeps plain line breaks. A break
// at the end of a block is dropped, as markdown has nothing to attach it to.
const PromptHardBreak = HardBreak.extend({
  addStorage: () => ({
    markdown: {
      serialize(
        state: { write: (text: string) => void },
        node: ProseMirrorNode,
        parent: ProseMirrorNode,
        index: number,
      ) {
        for (let i = index + 1; i < parent.childCount; i++) {
          if (parent.child(i).type !== node.type) {
            state.write('\n');
            return;
          }
        }
      },
    },
  }),
});

// The agent's system prompt as markdown, edited the way an issue description is: a
// bubble menu on selection and a "/" command list, no persistent toolbar. Content in
// and out is markdown, the format the agent runtime reads.
export default function AgentInstructionsEditor({
  defaultValue,
  onChange,
  placeholder,
  ariaLabel,
  className,
  autoFocus,
  slashContainer,
}: {
  defaultValue: string;
  onChange: (markdown: string) => void;
  placeholder: string;
  // The editing area is a contenteditable, not a form control a <label> can name.
  ariaLabel: string;
  className?: string;
  autoFocus?: boolean;
  // The overlay this editor sits in, where the "/" list mounts.
  slashContainer: string;
}) {
  const t = useTranslations('common.editor');
  const editorRef = useRef<Editor | null>(null);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      // link: the extension below configures it; StarterKit's copy would be a duplicate.
      StarterKit.configure({ text: false, hardBreak: false, link: false }),
      PromptText,
      PromptHardBreak,
      Placeholder.configure({ placeholder }),
      Link.configure({ openOnClick: false, autolink: true }),
      SlashCommand.configure({ container: slashContainer, codeBlockLabel: t('codeBlock') }),
      Markdown.configure({ html: false, linkify: true, breaks: true }),
    ],
    content: defaultValue,
    autofocus: autoFocus,
    editorProps: {
      attributes: { class: 'md-content flex-1 focus:outline-none', 'aria-label': ariaLabel },
      // A prompt is markdown source, so paste its text as markdown. An editor or a
      // web page also puts HTML on the clipboard, which ProseMirror would prefer and
      // which carries none of the "#" and ">" structure. Inside a code block the
      // text stays literal.
      handlePaste(view, event) {
        const text = event.clipboardData?.getData('text/plain');
        if (!text || view.state.selection.$from.parent.type.spec.code) return false;
        const { from, to } = view.state.selection;
        // insertContentAt is the command tiptap-markdown overrides to read markdown.
        return (
          editorRef.current?.chain().focus().insertContentAt({ from, to }, text).run() ?? false
        );
      },
    },
    onUpdate: ({ editor }) => onChange(editor.storage.markdown.getMarkdown()),
  });

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  if (!editor) return null;
  return (
    <div className={className}>
      <EditorSelectionMenu editor={editor} placement="bottom" />
      <EditorContent editor={editor} className="flex min-h-full flex-col" />
    </div>
  );
}
