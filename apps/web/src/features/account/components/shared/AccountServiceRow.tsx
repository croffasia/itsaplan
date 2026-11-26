import type { ReactNode } from 'react';

export default function AccountServiceRow({
  icon,
  name,
  info,
  children,
}: {
  icon: ReactNode;
  name: string;
  info?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex min-h-11 items-center gap-3 py-1 text-sm">
      <span className="flex shrink-0 text-muted-foreground [&_svg]:size-4">{icon}</span>
      <span className="w-18 shrink-0 sm:w-22">{name}</span>
      <span className="min-w-0 flex-1 wrap-anywhere text-muted-foreground" dir="auto">
        {info}
      </span>
      {children}
    </div>
  );
}
