import { useTranslations } from 'next-intl';
import { EmptyState } from '@/components/common/page/EmptyState';

export default function TeamIntegrationsEmpty({
  searchTerm,
  filtered,
}: {
  searchTerm: string | undefined;
  filtered: boolean;
}) {
  const t = useTranslations('teams.integrations');

  if (searchTerm !== undefined) {
    return (
      <EmptyState title={t('nothingFound')} description={t('noMatches', { query: searchTerm })} />
    );
  }
  if (filtered) {
    return <EmptyState title={t('nothingFound')} description={t('noKindMatches')} />;
  }
  return <EmptyState title={t('empty')} description={t('emptyHint')} />;
}
