import type { Metadata } from 'next';

// Pages a build serves to anyone with the link. Never indexed, as the share pages.
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return children;
}
