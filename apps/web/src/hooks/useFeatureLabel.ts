'use client';

import { useTranslations } from 'next-intl';
import type { ProjectFeatures } from '@/lib/api';

// What each optional section is called. Shared by the switches that turn a section
// off, their confirmation, and the notice the section shows while it is off, so it
// is named the same everywhere.
export function useFeatureLabel() {
  const t = useTranslations('common.features');
  return (feature: keyof ProjectFeatures) => t(feature);
}
