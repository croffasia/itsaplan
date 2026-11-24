import type { ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

// A flat row of the rail: Home, a favorite or a search result. It lines up with the titles of
// the tree rows.
export default function DocumentsRailLink({
  href,
  active,
  icon,
  title,
  detail,
}: {
  href: string;
  active: boolean;
  icon: ReactNode;
  title: string;
  detail?: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex h-8 items-center gap-2 rounded-md ps-6 pe-2 text-sm transition-colors duration-100 outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/60',
        active && 'bg-accent font-medium',
      )}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate" dir="auto">
        {title}
      </span>
      {detail}
    </Link>
  );
}
