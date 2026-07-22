import { FileText, Trash2, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

// One entry in the skill's file explorer. SKILL.md is pinned and cannot be
// deleted; reference files carry a size and a delete action.
export interface SkillFileEntry {
  path: string;
  label: string;
  size: number | null;
  deletable: boolean;
}

// Left-pane file explorer for the skill editor: a clickable list of the skill's
// files (SKILL.md plus its references), with an unsaved-changes dot, per-file
// delete, and an upload control to add a reference.
export function SkillFileList({
  files,
  selected,
  dirtyPaths,
  canEdit,
  onSelect,
  onDelete,
  onAddFile,
}: {
  files: SkillFileEntry[];
  selected: string;
  dirtyPaths: Set<string>;
  canEdit: boolean;
  onSelect: (path: string) => void;
  onDelete: (path: string) => void;
  onAddFile: (file: File) => void;
}) {
  return (
    <div className="flex min-h-0 flex-col">
      <div className="px-1 pb-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        Files
      </div>
      <div className="flex-1 space-y-0.5 overflow-y-auto">
        {files.map((f) => {
          const active = f.path === selected;
          return (
            <div
              key={f.path}
              className={cn(
                'group flex items-center gap-2 rounded-md px-2 py-1.5',
                active ? 'bg-secondary text-secondary-foreground' : 'hover:bg-accent',
              )}
            >
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
                onClick={() => onSelect(f.path)}
              >
                <FileText
                  className={cn('size-3.5 shrink-0', active ? '' : 'text-muted-foreground')}
                />
                <span className="truncate text-xs">{f.label}</span>
                {dirtyPaths.has(f.path) && (
                  <span
                    className="size-1.5 shrink-0 rounded-full bg-primary"
                    aria-label="Unsaved changes"
                  />
                )}
              </button>
              {f.size != null && (
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  {Math.max(1, Math.ceil(f.size / 1024))} KB
                </span>
              )}
              {canEdit && f.deletable && (
                <button
                  type="button"
                  className="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
                  onClick={() => onDelete(f.path)}
                  aria-label={`Delete ${f.label}`}
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>
      {canEdit && (
        <label className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border py-2 text-xs text-muted-foreground hover:border-foreground/30 hover:text-foreground">
          <Upload className="size-3.5" />
          Add reference
          <input
            type="file"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onAddFile(file);
              e.target.value = '';
            }}
          />
        </label>
      )}
    </div>
  );
}
