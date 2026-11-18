'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';

// Pages a signed-in person reaches outside the app: an invite, an MCP client's consent
// screen, a public link. No startup screen covers them.
const OUTSIDE_APP = ['/invite', '/oauth', '/share', '/p/'];

export default function StartupScreensGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (OUTSIDE_APP.some((path) => pathname.startsWith(path))) return null;
  return children;
}
