import type { ReactNode } from 'react';
import { Plus } from 'lucide-react';
import DocumentIconButton from '../DocumentIconButton';

export default function DocumentsRailGroup({
  label,
  create,
  children,
}: {
  label: string;
  create?: { label: string; title: string; disabled: boolean; onClick: () => void };
  children: ReactNode;
}) {
  return (
    <section className="group/rail mt-4">
      <h3 className="flex h-7 items-center gap-1.5 ps-6.5 pe-1 text-xs font-medium text-muted-foreground">
        {label}
        {create && (
          <DocumentIconButton
            label={create.title}
            aria-label={create.label}
            disabled={create.disabled}
            className="ms-auto size-5.5 opacity-0 group-hover/rail:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100 [&_svg:not([class*='size-'])]:size-3.5"
            onClick={create.onClick}
          >
            <Plus />
          </DocumentIconButton>
        )}
      </h3>
      {children}
    </section>
  );
}
