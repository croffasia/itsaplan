import type { ReactNode } from 'react';
import { FileText } from 'lucide-react';

// A page's emoji, or the file glyph when it has none.
export default function DocumentsRailIcon({
  icon,
  fallback,
}: {
  icon: string | null;
  fallback?: ReactNode;
}) {
  return (
    <span
      className="grid size-5 shrink-0 place-items-center text-[15px] leading-none text-muted-foreground"
      aria-hidden
    >
      {icon || fallback || <FileText className="size-3.5" />}
    </span>
  );
}
