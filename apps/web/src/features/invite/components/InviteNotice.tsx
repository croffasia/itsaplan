import type { ReactNode } from 'react';

// A short status message on the invite screen (wrong account), with an optional
// action area below it. Where the heading already names the state (not found,
// closed, expired) it carries no message, so the screen does not say it twice.
export default function InviteNotice({
  message,
  children,
}: {
  message?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
      {children}
    </div>
  );
}
