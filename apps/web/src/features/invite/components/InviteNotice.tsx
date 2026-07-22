import type { ReactNode } from 'react';

// A short status message on the invite screen (invite not found, no longer
// pending, wrong account), with an optional action area below it.
export default function InviteNotice({
  message,
  children,
}: {
  message: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
      {children}
    </div>
  );
}
