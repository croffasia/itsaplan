import type { Metadata } from 'next';

// Public read-only share pages. Never indexed: the token is unguessable but a
// shared page must not surface in search engines or be followed by crawlers.
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

export default function ShareLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -end-40 -top-40 size-[28rem] rounded-full bg-brand-mint/10 blur-3xl" />
        <div className="absolute -start-32 -bottom-48 size-[32rem] rounded-full border border-brand-teal/10" />
      </div>
      {children}
    </>
  );
}
