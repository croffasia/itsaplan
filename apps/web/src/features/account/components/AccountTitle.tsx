'use client';

import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ACCOUNT_SECTIONS } from '@/utils/accountSections';
import { useAccountSectionLabel } from '@/hooks/useSectionLabels';
import { titlePath, useDocumentTitle } from '@/hooks/useDocumentTitle';

// The tab title of an account page, `Account › Security`. The teams pages under
// /account name themselves.
export default function AccountTitle() {
  const t = useTranslations('meta.screens');
  const sectionLabel = useAccountSectionLabel();
  const slug = usePathname().split('/')[2];
  const section = ACCOUNT_SECTIONS.find((entry) => entry.slug === slug);
  useDocumentTitle(titlePath(t('account'), section && sectionLabel(section.slug)));
  return null;
}
