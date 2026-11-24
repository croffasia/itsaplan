'use client';

import { useParams } from 'next/navigation';
import SettingsExtraSectionPage from '@/features/settings/SettingsExtraSectionPage';

export default function Page() {
  const { section } = useParams<{ section: string }>();
  return <SettingsExtraSectionPage slug={section} />;
}
