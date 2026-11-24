import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowUpRight, type LucideIcon } from 'lucide-react';

// What a section of the agent form shows when the library it configures is empty:
// what is missing, why it matters here, and, where there is one, the page that fills
// it or the buttons that fill it from here. Used by Model (no provider key), Projects,
// Skills, and Tools so they read the same.
export function AgentEmptyNotice({
  icon: Icon,
  title,
  hint,
  href,
  linkLabel,
  children,
}: {
  icon: LucideIcon;
  title: string;
  hint: string;
  // The page that fills the library. Left out where the reader cannot go anywhere:
  // a team with no projects at all.
  href?: string;
  linkLabel?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg bg-muted/50 px-4 py-3.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
        {href && (
          <Link
            href={href}
            className="inline-flex items-center gap-1 pt-1 text-xs font-medium hover:underline"
          >
            {linkLabel}
            <ArrowUpRight className="size-3.5" />
          </Link>
        )}
        {children && <div className="pt-2">{children}</div>}
      </div>
    </div>
  );
}
