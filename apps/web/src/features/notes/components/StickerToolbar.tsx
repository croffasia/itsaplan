'use client';

import { useTranslations } from 'next-intl';
import { type Editor } from '@tiptap/react';
import { Bold, Italic, ListChecks, SquarePlus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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
    <Tooltip>
      <TooltipTrigger
        type="button"
        aria-label={label}
        // Keep the editor selection when the toolbar is clicked.
        onMouseDown={(e) => e.preventDefault()}
        onClick={onClick}
        className={cn(
          'nodrag flex size-7 cursor-pointer items-center justify-center rounded text-black/50 hover:bg-black/10 hover:text-black/80 [&_svg]:size-3.5',
          active && 'bg-black/15 text-black',
        )}
      >
        {children}
      </TooltipTrigger>
      {/* The toolbar sits at the bottom of the note, so a tooltip above it would
          cover the text being edited. */}
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

// The persistent bottom toolbar of a sticky note. Without canEdit only "convert to
// issue" is left.
export default function StickerToolbar({
  editor,
  color,
  onColorChange,
  onConvert,
  onDelete,
  canEdit,
}: {
  editor: Editor | null;
  color: string;
  onColorChange: (key: string) => void;
  onConvert?: () => void;
  onDelete: () => void;
  canEdit: boolean;
}) {
  const t = useTranslations('notes');
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-0.5">
        {canEdit && (
          <>
            <StickerColorPicker value={color} onChange={onColorChange} />
            <ToolbarButton
              label={t('bold')}
              active={editor?.isActive('bold')}
              onClick={() => editor?.chain().focus().toggleBold().run()}
            >
              <Bold />
            </ToolbarButton>
            <ToolbarButton
              label={t('italic')}
              active={editor?.isActive('italic')}
              onClick={() => editor?.chain().focus().toggleItalic().run()}
            >
              <Italic />
            </ToolbarButton>
            <ToolbarButton
              label={t('checklist')}
              active={editor?.isActive('taskList')}
              onClick={() => editor?.chain().focus().toggleTaskList().run()}
            >
              <ListChecks />
            </ToolbarButton>
          </>
        )}
      </div>
      <div className="flex items-center gap-0.5">
        {onConvert && (
          <ToolbarButton label={t('convertToIssue')} onClick={onConvert}>
            <SquarePlus />
          </ToolbarButton>
        )}
        {canEdit && (
          <ToolbarButton label={t('deleteNote')} onClick={onDelete}>
            <Trash2 />
          </ToolbarButton>
        )}
      </div>
    </div>
  );
}
