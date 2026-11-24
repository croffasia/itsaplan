import type { ReactNode } from 'react';

export default function DocumentsRailEmpty({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="py-4 ps-6.5 pe-3 text-[13px] text-muted-foreground">
      <p className="mb-1 text-sm font-medium text-foreground">{title}</p>
      {description && <p>{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
