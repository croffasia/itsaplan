import { type Editor } from '@tiptap/react';
import { Bold, Italic, ListChecks, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import StickerColorPicker from './StickerColorPicker';

function ToolbarButton({
  active,
  onClick,
  label,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      // Keep the editor selection when the toolbar is clicked.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        'nodrag flex size-7 cursor-pointer items-center justify-center rounded text-black/50 hover:bg-black/10 hover:text-black/80 [&_svg]:size-3.5',
        active && 'bg-black/15 text-black',
      )}
    >
      {children}
    </button>
  );
}

// The persistent bottom toolbar of a sticky note: background color, bold, italic,
// a checklist toggle, and delete.
export default function StickerToolbar({
  editor,
  color,
  onColorChange,
  onDelete,
}: {
  editor: Editor | null;
  color: string;
  onColorChange: (key: string) => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-0.5">
        <StickerColorPicker value={color} onChange={onColorChange} />
        <ToolbarButton
          label="Bold"
          active={editor?.isActive('bold')}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          <Bold />
        </ToolbarButton>
        <ToolbarButton
          label="Italic"
          active={editor?.isActive('italic')}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          <Italic />
        </ToolbarButton>
        <ToolbarButton
          label="Checklist"
          active={editor?.isActive('taskList')}
          onClick={() => editor?.chain().focus().toggleTaskList().run()}
        >
          <ListChecks />
        </ToolbarButton>
      </div>
      <ToolbarButton label="Delete note" onClick={onDelete}>
        <Trash2 />
      </ToolbarButton>
    </div>
  );
}
