import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export default function AccountNotificationChannelRow({
  icon: Icon,
  name,
  info,
  children,
}: {
  icon: LucideIcon;
  name: string;
  info?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex min-h-11 items-center gap-3 py-1 text-sm">
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <span className="w-18 shrink-0 sm:w-22">{name}</span>
      <span className="min-w-0 flex-1 wrap-anywhere text-muted-foreground" dir="auto">
        {info}
      </span>
      {children}
    </div>
  );
}
