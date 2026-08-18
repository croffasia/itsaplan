'use client';

import { Circle, Highlighter, Square, Undo2, type LucideIcon } from 'lucide-react';
import { ANNOTATION_COLORS, type AnnotationTool } from '../utils/annotations';
import EditorToolbarButton from '@/components/common/editor/EditorToolbarButton';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';

const TOOLS: { id: AnnotationTool; icon: LucideIcon }[] = [
  { id: 'marker', icon: Highlighter },
  { id: 'rect', icon: Square },
  { id: 'ellipse', icon: Circle },
];

export default function IssueImageAnnotatorToolbar({
  tool,
  onToolChange,
  color,
  onColorChange,
  canUndo,
  onUndo,
  onSave,
}: {
  tool: AnnotationTool;
  onToolChange: (tool: AnnotationTool) => void;
  color: string;
  onColorChange: (color: string) => void;
  canUndo: boolean;
  onUndo: () => void;
  onSave: () => void;
}) {
  const tCommon = useTranslations('common');
  const t = useTranslations('issue.annotator');
  return (
    <div className="mt-4 flex items-center gap-1 border-t pt-3">
      {TOOLS.map((item) => (
        <EditorToolbarButton
          key={item.id}
          active={tool === item.id}
          title={t(`tools.${item.id}`)}
          onClick={() => onToolChange(item.id)}
        >
          <item.icon />
        </EditorToolbarButton>
      ))}

      <span className="mx-2 h-6 w-px bg-border" />

      {ANNOTATION_COLORS.map((value) => (
        <button
          key={value}
          type="button"
          aria-label={t('color', { color: value })}
          aria-pressed={color === value}
          onClick={() => onColorChange(value)}
          className={cn(
            'flex size-7 items-center justify-center rounded hover:bg-accent',
            color === value && 'bg-accent',
          )}
        >
          <span className="size-3.5 rounded-full" style={{ backgroundColor: value }} />
        </button>
      ))}

      <span className="mx-2 h-6 w-px bg-border" />

      <EditorToolbarButton disabled={!canUndo} title={t('undo')} onClick={onUndo}>
        <Undo2 />
      </EditorToolbarButton>

      <Button className="ml-auto" onClick={onSave}>
        {tCommon('save')}
      </Button>
    </div>
  );
}
