import { useCallback } from 'react';
import { type Editor, useEditorState } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

const ITEMS = [
  {
    label: 'tableAddRow',
    icon: Plus,
    run: (editor: Editor) => editor.chain().focus().addRowAfter().run(),
  },
  {
    label: 'tableDeleteRow',
    icon: Minus,
    run: (editor: Editor) => editor.chain().focus().deleteRow().run(),
  },
  {
    label: 'tableAddColumn',
    icon: Plus,
    run: (editor: Editor) => editor.chain().focus().addColumnAfter().run(),
  },
  {
    label: 'tableDeleteColumn',
    icon: Minus,
    run: (editor: Editor) => editor.chain().focus().deleteColumn().run(),
  },
  {
    label: 'tableDelete',
    icon: Trash2,
    run: (editor: Editor) => editor.chain().focus().deleteTable().run(),
  },
] as const;

// The table the cursor sits in, which the menu sits above.
function tableElement(editor: Editor): HTMLElement | null {
  const { node } = editor.view.domAtPos(editor.state.selection.from);
  const element = node instanceof HTMLElement ? node : node.parentElement;
  return element?.closest('table') ?? null;
}

const OPTIONS = { placement: 'top-start', offset: 8 } as const;

function shouldShow({ editor, state }: { editor: Editor; state: Editor['state'] }) {
  return state.selection.empty && editor.isActive('table');
}

// Row and column commands for the table the cursor sits in. Shown only while
// nothing is selected: a selection inside a cell belongs to EditorSelectionMenu,
// which formats the text, and two bubble menus over one selection would overlap.
export default function EditorTableMenu({ editor }: { editor: Editor }) {
  const t = useTranslations('common.editor');
  // A Markdown table needs its header row, so the header row cannot be deleted.
  const inHeader = useEditorState({
    editor,
    selector: ({ editor: current }) => current.isActive('tableHeader'),
  });
  const reference = useCallback(() => tableElement(editor), [editor]);

  return (
    <BubbleMenu
      editor={editor}
      options={OPTIONS}
      shouldShow={shouldShow}
      getReferencedVirtualElement={reference}
      className="flex max-w-[calc(100vw-2rem)] flex-wrap items-center gap-0.5 rounded-lg border border-border/55 bg-popover p-1 shadow-[var(--overlay-shadow)]"
    >
      {ITEMS.map((item) => (
        <button
          key={item.label}
          type="button"
          disabled={item.label === 'tableDeleteRow' && inHeader}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => item.run(editor)}
          className={cn(
            'inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[13px] transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-45 [&_svg]:size-3.5 [&_svg]:text-muted-foreground',
            item.label === 'tableDelete' && 'text-destructive [&_svg]:text-destructive',
          )}
        >
          <item.icon />
          {t(item.label)}
        </button>
      ))}
    </BubbleMenu>
  );
}
