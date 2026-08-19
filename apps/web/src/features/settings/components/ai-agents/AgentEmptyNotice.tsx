import Link from 'next/link';
import { ArrowUpRight, type LucideIcon } from 'lucide-react';

// What a section of the agent form shows when the library it configures is empty:
// what is missing, why it matters here, and the page that fills it. Used by Model
// (no provider key), Skills, and Tools so the three read the same.
export function AgentEmptyNotice({
  icon: Icon,
  title,
  hint,
  href,
  linkLabel,
}: {
  icon: LucideIcon;
  title: string;
  hint: string;
  href: string;
  linkLabel: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg bg-muted/50 px-4 py-3.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
        <Link
          href={href}
          className="inline-flex items-center gap-1 pt-1 text-xs font-medium hover:underline"
        >
          {linkLabel}
          <ArrowUpRight className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}
