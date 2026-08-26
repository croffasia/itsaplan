import type { ReactNode } from 'react';
import { GripVertical, MoreHorizontal, SlidersHorizontal } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { WidgetInstance } from '@/utils/dashboardWidgets';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

// A borderless widget section: a quiet header (title + edit affordances) over a
// hairline divider, then the body directly on the page. No card box — surfaces are
// separated by space and the header rule, per DESIGN.md. Widget settings live in a
// popover opened from the header, not inline in the body, so shrinking the widget's
// height never hides them. The `.widget-drag-handle` grip is react-grid-layout's
// drag handle; `movable` is off when the grid does not accept drags, and size is
// set from the corner instead (see WidgetGrid).
export default function WidgetFrame({
  widget,
  editing,
  movable,
  settings,
  onRename,
  onRemove,
  children,
}: {
  widget: WidgetInstance;
  editing: boolean;
  movable: boolean;
  settings?: ReactNode;
  onRename: (title: string) => void;
  onRemove: () => void;
  children: ReactNode;
}) {
  const t = useTranslations('dashboards');
  // A saved layout is stored as an opaque jsonb blob, so its widget type is not
  // guaranteed to be in the catalog; fall back to the raw type instead of rendering
  // a key path.
  const labelKey = `widgets.${widget.type}.label` as const;
  const defaultTitle = t.has(labelKey) ? t(labelKey) : widget.type;
  const title = widget.title || defaultTitle;
  return (
    <section className="flex h-full flex-col">
      <header className="mb-4 flex items-center gap-2 border-b border-border/60 pb-2">
        {movable && (
          <button
            type="button"
            title={t('dragToMove')}
            className="widget-drag-handle -ms-1 cursor-grab touch-none text-muted-foreground/60 hover:text-foreground"
          >
            <GripVertical className="size-4" />
          </button>
        )}
        {editing ? (
          <input
            value={widget.title ?? ''}
            onChange={(e) => onRename(e.target.value)}
            placeholder={defaultTitle}
            aria-label={t('widgetName')}
            className="min-w-0 flex-1 rounded-md bg-transparent px-1 py-0.5 text-sm font-semibold tracking-tight text-foreground outline-none placeholder:text-muted-foreground/60 focus:bg-accent/50"
          />
        ) : (
          <h3 className="min-w-0 flex-1 truncate text-sm font-semibold tracking-tight text-foreground">
            {title}
          </h3>
        )}
        {editing && settings && (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                title={t('widgetSettings')}
                className="rounded p-0.5 text-muted-foreground/60 hover:text-foreground"
              >
                <SlidersHorizontal className="size-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-auto max-w-[calc(100vw-2rem)] min-w-64 p-3">
              {settings}
            </PopoverContent>
          </Popover>
        )}
        {editing && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                title={t('widgetOptions')}
                className="rounded p-0.5 text-muted-foreground/60 hover:text-foreground"
              >
                <MoreHorizontal className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem variant="destructive" onClick={onRemove}>
                {t('removeWidget')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </header>
      {/* The gutter is reserved whether or not the scrollbar is there: a widget that
          sizes itself to this width would otherwise lose the room to the scrollbar,
          fit less, become shorter, and take the scrollbar away again. */}
      <div className="min-h-0 flex-1 [scrollbar-gutter:stable] overflow-y-auto">{children}</div>
    </section>
  );
}
