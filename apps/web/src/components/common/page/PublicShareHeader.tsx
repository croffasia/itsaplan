import AppLogo from '@/components/common/AppLogo';
import { APP_NAME, APP_SITE_URL } from '@/utils/app';

// The header over a public shared page (a board or an issue). It shows the project
// name, the ticker, and an optional trailing label. On a board that label is the
// shared view's name. The product mark links to the product site. The header shows
// identity only, with no app navigation and no session.
export default function PublicShareHeader({
  name,
  ticker,
  trailing,
}: {
  name: string;
  ticker: string;
  trailing?: string;
}) {
  return (
    <header className="relative flex shrink-0 items-center gap-3 border-b bg-linear-to-r from-primary/10 via-background/80 to-background/80 px-4 py-3 backdrop-blur">
      <span
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-px bg-linear-to-r from-brand-teal via-brand-mint to-transparent"
      />
      <div className="flex min-w-0 items-baseline gap-2">
        <span className="truncate text-base font-semibold">{name}</span>
        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
          {ticker}
        </span>
        {trailing && (
          <span className="min-w-0 truncate text-sm text-muted-foreground">
            <span className="pe-2">/</span>
            {trailing}
          </span>
        )}
      </div>
      <a
        href={APP_SITE_URL}
        target="_blank"
        rel="noreferrer"
        className="ms-auto flex shrink-0 items-center gap-1.5 rounded-full border border-primary/20 bg-background/60 py-1 ps-1.5 pe-3 text-muted-foreground transition-colors hover:text-foreground"
      >
        <AppLogo className="size-5" />
        <span className="text-sm font-semibold text-primary">{APP_NAME}</span>
      </a>
    </header>
  );
}
