'use client';

import { notFound } from 'next/navigation';
import { GOD_SECTIONS } from '@/utils/godSections';

// A god mode section without a route of its own: one the hosted build adds.
export default function GodExtraSectionPage({ slug }: { slug: string }) {
  const section = GOD_SECTIONS.find((entry) => entry.slug === slug);
  if (!section?.Component) notFound();
  return <section.Component />;
}
