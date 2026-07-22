import type { ReactNode } from 'react';

// One block of an account page: a heading over an optional explanation, with an
// optional control on the right of that heading, then the content it introduces.
// Blocks are separated by a rule, except the first. Shared by the Profile and
// Security pages.
export default function AccountSection({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  // Rendered on the right of the heading row, e.g. an "Add passkey" button.
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="border-t py-6 first:border-t-0 first:pt-0">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-medium">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
      {children}
    </section>
  );
}
