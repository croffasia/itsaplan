'use client';

import { useParams } from 'next/navigation';
import GodExtraSectionPage from '@/features/god/GodExtraSectionPage';

export default function Page() {
  const { section } = useParams<{ section: string }>();
  return <GodExtraSectionPage slug={section} />;
}
