'use client';

import CoreBrandPanel from '@/components/common/page/BrandPanel';

// The panel beside the form on the logged-out screens and the invite screen. A self-hosted
// instance shows the core's; the hosted build can draw its own.
export default function BrandPanel({ subtitle }: { subtitle?: string }) {
  return <CoreBrandPanel subtitle={subtitle} />;
}
