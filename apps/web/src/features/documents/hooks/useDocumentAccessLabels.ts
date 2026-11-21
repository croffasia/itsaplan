import { useTranslations } from 'next-intl';
import type { AccessLabels } from '@/components/common/access/accessVisibility';

export function useDocumentAccessLabels(): AccessLabels {
  const t = useTranslations('documents');
  return {
    access: t('access.title'),
    placeholder: t('access.placeholder'),
    nothingFound: t('access.nothingFound'),
    members: t('access.members'),
    agents: t('access.agents'),
    agent: t('access.agent'),
    noAccess: t('access.noAccess'),
    listHint: t('access.listHint'),
    visibility: {
      public: t('access.visibility.public'),
      private: t('access.visibility.private'),
      restricted: t('access.visibility.restricted'),
    },
  };
}
