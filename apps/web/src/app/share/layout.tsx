import type { Metadata } from 'next';

// Public read-only share pages. Never indexed: the token is unguessable but a
// shared page must not surface in search engines or be followed by crawlers.
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

export default function ShareLayout({ children }: { children: React.ReactNode }) {
  return children;
}
