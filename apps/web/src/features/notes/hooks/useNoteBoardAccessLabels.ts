import { useTranslations } from 'next-intl';
import type { AccessLabels } from '@/components/common/access/accessVisibility';

export function useNoteBoardAccessLabels(): AccessLabels {
  const t = useTranslations('notes');
  return {
    access: t('boardAccess'),
    placeholder: t('boardAccessPlaceholder'),
    nothingFound: t('nothingFound'),
    members: t('members'),
    agents: t('agents'),
    agent: t('agent'),
    noAccess: t('noAccessShort'),
    listHint: t('accessHint'),
    visibility: {
      public: t('visibility.public'),
      private: t('visibility.private'),
      restricted: t('visibility.restricted'),
    },
  };
}
