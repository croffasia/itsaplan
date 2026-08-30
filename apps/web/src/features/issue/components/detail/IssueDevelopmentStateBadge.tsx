import { GitMerge } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type DevelopmentLink } from '@/lib/api';
import { Badge } from '@/components/ui/badge';

export default function IssueDevelopmentStateBadge({ link }: { link: DevelopmentLink }) {
  const t = useTranslations('issue.development');
  if (link.draft) return <Badge variant="secondary">{t('draft')}</Badge>;
  if (link.state === 'merged')
    return (
      <Badge variant="secondary" className="text-violet-600 dark:text-violet-400">
        <GitMerge /> {t('merged')}
      </Badge>
    );
  if (link.state === 'closed') return <Badge variant="outline">{t('closed')}</Badge>;
  if ((link.checkStatus ?? link.pipelineStatus) === 'success')
    return (
      <Badge variant="outline" className="text-emerald-600 dark:text-emerald-400">
        {t('ready')}
      </Badge>
    );
  return <Badge variant="outline">{t('open')}</Badge>;
}
